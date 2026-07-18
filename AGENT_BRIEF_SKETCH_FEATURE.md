# AGENT BRIEF — Map My Block: OpenCV Sketch + Home Comparison Slider

**Copy this entire document into any AI coding agent.** It is the single source of truth for implementing this feature in the existing codebase.

---

## 0. Product context (do not invent features outside this)

| Item | Value |
|---|---|
| Project | Map My Block (`census-mapper`) — Census 2027 enumerator PWA |
| Stack | Next.js **16.2.10** (App Router), React **19**, TypeScript, Leaflet / react-leaflet, Tailwind 4, `html-to-image`, localforage, `next-pwa` |
| Repo root | Workspace root of this project |
| Map page | `src/app/map/page.tsx` → dynamic `MapComponent` (`ssr: false`) |
| Home | `src/components/HomeScreen.tsx` (route `/`) |
| State | Client-only; project in IndexedDB via `src/lib/storage.ts` |
| **No API routes exist today** | Do **not** add a Python/OpenCV server unless explicitly asked later |
| Docs rule | Read `AGENTS.md` / product scope. Do **not** add login, dashboards, or purple AI-slop UI |

### Related product copy (already on home)

Home already claims: “upload images or pdf and get them in handwritten format” — this feature starts delivering that promise for **map capture → sketch**.

---

## 1. Goals (implement exactly these)

### Feature A — Home marketing slider (zero processing)

- On the **home screen only**, show a before/after **comparison slider**.
- Use **two static images** already in `/public` (or added by the implementer).
- **No OpenCV**, no Web Worker, no network conversion, no caching of processed results.
- Sliding only reveals one image over the other (CSS clip / width mask).

### Feature B — Sketch map (main product feature)

- In **field mode**, user clicks a **Sketch** button (separate from Export).
- App **navigates to a new page** (e.g. `/sketch`).
- That page:
  1. Shows a loading state
  2. Receives / loads the captured map PNG
  3. Runs **OpenCV.js in a Web Worker** to produce a hand-drawn / sketch-like B&W image
  4. Shows a **preview**
  5. Offers **Download** of the sketch PNG
- **No comparison slider on the sketch page** (slider is home-only).
- Conversion must cause **no network call** (after OpenCV assets are already part of the app bundle / `public/`).
- Must not freeze the map UI: processing happens **off the main thread**.

### Explicit non-goals (this phase)

- Do **not** train or call AI / Flux / Kontext / Stable Diffusion.
- Do **not** expect OpenCV output to look **exactly** like scanned HLB paper maps with triangles + handwriting (that requires a later **vector redraw** phase — see §11).
- Do **not** cache the **sketch result** across edits (always sketch from a fresh capture).
- Do **not** add a backend server for OpenCV.

---

## 2. Critical clarifications (agent must not confuse these)

### 2.1 “Cache OpenCV” ≠ “cache sketch image”

| Term | Meaning | Required? |
|---|---|---|
| Keep OpenCV **module** loaded in the worker after first init | Reuse the *library* so the next Sketch click doesn’t re-download/re-init WASM | **Yes (performance)** |
| Cache the **output PNG** of a previous sketch | Reuse an old sketch when the map changed | **No — forbidden** |

Every Sketch run:

1. Capture **current** map pixels (or use the capture taken just before navigate)
2. Run OpenCV on **that** bitmap
3. Show new preview

If the user edits tags and sketches again → new capture → new sketch.

### 2.2 WASM

OpenCV.js **is** OpenCV compiled to WebAssembly. There is no separate “OpenCV without WASM” in the browser. Alternatives would be pure Canvas filters (weaker) or a server (rejected).

### 2.3 Server

**Not required.** OpenCV.js runs in the browser. Next.js static hosting / existing deploy is enough.

### 2.4 npm package

Prefer an npm OpenCV.js package (e.g. `@techstark/opencv-js` or equivalent maintained build) **or** vendoring `opencv.js` + `.wasm` under `public/opencv/`. Either is fine; assets must be same-origin so the PWA can cache them. Do not rely on a random CDN that fails offline.

### 2.5 “Host” means

Ship OpenCV files with the app (`node_modules` bundled or files in `public/`). Not “host a Python API.”

---

## 3. End-to-end flows

### 3.1 Home slider

```
HomeScreen loads
  → render ImageCompareSlider
      before = /public/demo-map-before.png   (or existing hero + a sketch demo)
      after  = /public/demo-map-after.png
  → user drags range 0–100
  → CSS reveals before↔after
  → zero JS image processing
```

### 3.2 Sketch feature

```
Map (field mode) → user taps "Sketch"
  → captureMapImage(exportRef) via html-to-image toPng
  → store data URL in sessionStorage key `map-my-block-sketch-source` (or pass via memory store)
  → router.push('/sketch')

/sketch page mounts
  → read source data URL
  → if missing → show error + link back to /map
  → show Loading UI ("Generating sketch…")
  → postMessage image to sketch.worker.ts
  → worker: ensure OpenCV ready (init once per worker lifetime)
  → worker: run sketch pipeline → return sketch data URL
  → show Preview + Download button
  → Download: <a download="census-sketch-YYYY-MM-DD.png">
```

Optional: also allow “Regenerate” which re-posts the **same** source capture to the worker (no new map capture unless user goes back to map).

---

## 4. Files to create / change

### Create

| Path | Purpose |
|---|---|
| `src/lib/captureMapImage.ts` | Shared `toPng` helper extracted from `exportMap` |
| `src/lib/sketch/sketchClient.ts` | Promise API: `createSketchFromDataUrl(dataUrl) → Promise<string>` talking to worker |
| `src/workers/sketch.worker.ts` | OpenCV init (once) + sketch algorithm |
| `src/lib/sketch/sketchPipeline.ts` | Pure documentation of steps OR shared constants (thresholds) — optional if logic lives only in worker |
| `src/app/sketch/page.tsx` | Loading → preview → download UI (`'use client'`) |
| `src/components/ImageCompareSlider.tsx` | Home before/after slider |
| `public/demo-map-before.png` | Static home “before” (street or satellite sample) |
| `public/demo-map-after.png` | Static home “after” (pre-made sketch / HLB-style demo) |

### Modify

| Path | Change |
|---|---|
| `src/components/MapComponent.tsx` | Refactor `exportMap` to use `captureMapImage`; add Sketch button in field bottom bar; navigate after capture |
| `src/components/HomeScreen.tsx` | Replace or wrap hero with `ImageCompareSlider` |
| `package.json` | Add OpenCV.js dependency (or document vendored files) |
| `next.config.mjs` | Ensure webpack can load workers + WASM if needed (`webpack` config for `Worker`, `asset/resource` for `.wasm`) |
| `public/sw.js` / PWA caching | Prefer caching OpenCV assets (via next-pwa runtimeCaching for `/opencv/*` or hashed static assets) |

### Do not modify for this feature

- Boundary drawing logic
- Tag icon SVGs (except if sketch page needs branding)
- Auth / profile reset flows

---

## 5. Implementation details

### 5.1 Extract capture helper

**Current code** (approx in `MapComponent.tsx`):

```ts
const dataUrl = await withTimeout(
  toPng(exportRef.current, {
    cacheBust: true,
    pixelRatio: 2,
    filter: (node) => !(node instanceof HTMLElement && node.dataset.exportHidden === 'true')
  }),
  exportTimeoutMs,
  'Export timed out'
);
```

**New shared helper** `src/lib/captureMapImage.ts`:

```ts
import { toPng } from 'html-to-image';
import { withTimeout } from './reliability';

const DEFAULT_TIMEOUT_MS = 18000;

export type CaptureMapImageOptions = {
  pixelRatio?: number;
  timeoutMs?: number;
};

export async function captureMapImage(
  element: HTMLElement,
  options: CaptureMapImageOptions = {}
): Promise<string> {
  const { pixelRatio = 2, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  return withTimeout(
    toPng(element, {
      cacheBust: true,
      pixelRatio,
      filter: (node) =>
        !(node instanceof HTMLElement && node.dataset.exportHidden === 'true'),
    }),
    timeoutMs,
    'Map capture timed out'
  );
}
```

**`exportMap` becomes:**

```ts
const dataUrl = await captureMapImage(exportRef.current);
// then trigger download as today
```

**Sketch button:**

```ts
const goToSketch = async () => {
  if (!exportRef.current || isSketching) return;
  setIsSketching(true);
  try {
    // Optional: slightly lower pixelRatio for faster sketch (e.g. 1.5)
    const dataUrl = await captureMapImage(exportRef.current, { pixelRatio: 1.5 });
    sessionStorage.setItem('map-my-block-sketch-source', dataUrl);
    router.push('/sketch');
  } catch (e) {
    setExportError('Could not capture map for sketch. Retry.');
  } finally {
    setIsSketching(false);
  }
};
```

`MapComponent` needs `useRouter` from `next/navigation` if not already present.

**UI placement:** Field mode bottom bar (`mode === 'field'`), next to Export — e.g. a button with `Pencil` / `Sparkles` icon, title “Sketch map”. Keep Export behavior unchanged.

### 5.2 Session key contract

```ts
export const SKETCH_SOURCE_KEY = 'map-my-block-sketch-source';
export const SKETCH_RESULT_KEY = 'map-my-block-sketch-result'; // optional; clear on new capture
```

- Write source **only** when leaving map for sketch.
- Clear result when starting a new conversion.
- Do **not** persist sketches in localforage unless product later asks.

### 5.3 Web Worker + OpenCV

**Client** `src/lib/sketch/sketchClient.ts`:

- Create worker **once** (module singleton) so OpenCV stays initialized in that worker.
- API:

```ts
export function createSketchFromDataUrl(sourceDataUrl: string): Promise<string>;
```

- Message protocol:

```ts
// main → worker
{ type: 'sketch'; id: string; dataUrl: string; maxWidth?: number }

// worker → main
{ type: 'ready' }
{ type: 'success'; id: string; dataUrl: string }
{ type: 'error'; id: string; message: string }
{ type: 'progress'; id: string; percent: number } // optional
```

**Worker rules:**

1. On first message (or on worker start), `await cv` / load OpenCV once; set `let ready = true`.
2. Never reload OpenCV on subsequent sketch messages.
3. Decode data URL → `ImageData` / `cv.Mat`.
4. Downscale so longest side ≤ `maxWidth` (default **1280**) for speed; preview uses this. (Optional later: “Download HQ” at 2048.)
5. Run pipeline (below).
6. Encode PNG data URL; `mat.delete()` all mats to avoid WASM leaks.
7. On error, return `{ type: 'error' }` — page shows Retry.

### 5.4 Sketch pipeline (classical CV — no AI)

Implement a readable “ink on paper” look suitable for maps:

```
1. Decode BGR/RGBA image
2. cvtColor → GRAY
3. bilateralFilter (preserve edges, smooth flat areas)
4. medianBlur (small ksize, e.g. 3 or 5)
5. adaptiveThreshold OR Canny edges
   - Preferred for maps: adaptiveThreshold (Gaussian) → binary ink lines
   - Alternative: Canny → bitwise_not → blend
6. Optional: morphological open/close to clean speckles
7. Invert if needed so result is black lines on white background
8. Optional: slight paper tint (#faf9f5) as background instead of pure white
9. Encode PNG
```

Tune constants in one place (`SKETCH_PARAMS`) so design can adjust without hunting magic numbers.

**Important:** Output will look like an **edge/sketch filter of the screenshot**, not an HLB schematic with hand-drawn triangles. That is accepted for this phase.

### 5.5 `/sketch` page UX

Mobile-first, matches app tone (`#212121`, `#faf9f5` background — follow `HomeScreen` / existing map chrome; avoid purple gradients).

States:

1. **Boot** — reading sessionStorage  
2. **Loading** — spinner + “Generating hand-drawn sketch…” (disable back-spam)  
3. **Preview** — image, Download, “Back to map”, optional “Try again”  
4. **Error** — message + Back to map  

Download filename: `census-sketch-YYYY-MM-DD.png`.

Page must be `'use client'`. Dynamic import worker only in browser.

### 5.6 Home `ImageCompareSlider`

```tsx
type Props = {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt?: string;
  afterAlt?: string;
  initial?: number; // 0–100, default 50
};
```

Behavior:

- Stack two images same size (`object-cover`, aspect ratio fixed).
- Vertical divider + draggable handle + range input for a11y.
- `aria-label="Compare map and sketch"`.
- No OpenCV imports on home bundle path — keep home JS light (do not import sketch worker from HomeScreen).

Integrate into `HomeScreen` right column (replace single `hero-image.png` or overlay slider using demo assets). Keep brand/layout rules from existing home.

---

## 6. Next.js / webpack / PWA notes

- Dev script uses webpack: `"dev": "next dev --webpack"` — configure workers accordingly.
- Prefer:

```ts
new Worker(new URL('../workers/sketch.worker.ts', import.meta.url));
```

- If using `.wasm` from `public/opencv/`, set `cv` locateFile to `/opencv/opencv_js.wasm`.
- Add runtimeCaching entry for OpenCV static paths (CacheFirst, long maxAge) so offline PWA still sketches after first visit.
- Do not block first paint of `/` on OpenCV — home never loads it.

---

## 7. Performance checklist (must pass)

- [ ] OpenCV never runs on the main thread  
- [ ] Home page does not import OpenCV or the worker  
- [ ] First Sketch may show load/init; later sketches in same session reuse worker OpenCV  
- [ ] Preview max width capped (≤1280)  
- [ ] Slider drag does no image processing  
- [ ] Sketch result not reused after map edits (new capture each Sketch navigation)  
- [ ] Mats deleted in worker after each run  
- [ ] Capture respects `data-export-hidden="true"` (same as export)  

---

## 8. Acceptance criteria

### Home

- Slider moves smoothly between two static images.
- Network tab: **no** conversion requests when sliding.
- Works on mobile width.

### Sketch

- Field mode shows Sketch control.
- Click → capture → `/sketch` → loading → preview.
- Download saves a B&W/sketch-like PNG.
- Works for both street and satellite basemap (no basemap-specific branches required).
- Editing map then Sketch again produces an updated sketch (not an old cached PNG).
- Map page remains usable; no long main-thread freeze during conversion.
- Offline (after assets cached): sketch still works without network.

### Regression

- Existing Export PNG still works.
- Setup / field / tags / boundary unchanged.

---

## 9. Suggested implementation order

1. `captureMapImage` + refactor `exportMap`  
2. `ImageCompareSlider` + home static assets  
3. Worker stub (echo image) + `/sketch` page shell  
4. Wire Map → sessionStorage → `/sketch`  
5. Integrate OpenCV.js + real pipeline  
6. PWA cache + downscale + mat cleanup  
7. Polish loading/error/download  

---

## 10. Dependencies (agent choice — pick one and document in PR)

**Option A (npm):**

```bash
npm install @techstark/opencv-js
```

**Option B (vendor):**

- Place `opencv.js` + wasm under `public/opencv/`
- Load via `importScripts` or dynamic script in worker

Pin versions in `package.json`. Prefer Option A if build integrates cleanly with Next 16 webpack.

---

## 11. Out of scope but documented for later (do not implement unless asked)

### Exact HLB paper-map look (triangles, arrows, handwriting)

OpenCV cannot learn from the user’s sample HLB scans. Future approach:

- **Vector redraw** from `CensusProject.features` + `boundary` onto A4 canvas/SVG using existing `TagIcons` / census symbology  
- Optional GeoPDF upload → extract georeference/bbox → align or import vectors  
- Optional ML (Flux etc.) = separate AI/backend decision — not this brief  

### GeoPDF

Useful for coordinates / georeferencing, not for inventing HLB ink style by itself.

---

## 12. Copy-paste system prompt (optional short form)

If another agent only needs a short kickoff prompt, use:

```
Implement Feature A + B from AGENT_BRIEF_SKETCH_FEATURE.md in this Map My Block Next.js PWA.

A) HomeScreen: static before/after ImageCompareSlider (2 public PNGs, zero processing).
B) Field-mode Sketch button → captureMapImage (shared with export via html-to-image) → sessionStorage → /sketch page → OpenCV.js in Web Worker → loading → preview → download. No server. No AI. Do not cache sketch outputs; only keep OpenCV initialized inside the worker. Slider is home-only, not on /sketch. Follow performance checklist and acceptance criteria in the brief. Match existing mobile UI (#212121 / #faf9f5). Read AGENTS.md. Do not add Python backend.
```

---

## 13. Reference locations in current code

| What | Where |
|---|---|
| Export capture | `src/components/MapComponent.tsx` — `exportMap` (~line 1147), `exportRef`, `toPng` |
| Field bottom actions | Same file — `mode === 'field'` bottom bar (~1664) |
| Hide chrome from export | `data-export-hidden="true"` on UI chrome |
| Home hero | `src/components/HomeScreen.tsx` |
| Project types | `src/lib/storage.ts` — `CensusFeature`, `CensusProject` |
| Timeouts | `src/lib/reliability.ts` — `withTimeout` |
| PWA config | `next.config.mjs` |

---

**End of brief.** Implement only §1 goals unless the user expands scope to §11.
