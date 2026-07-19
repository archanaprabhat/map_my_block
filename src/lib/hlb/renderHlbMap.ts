import { CensusFeature, CensusProject, Coordinate, TagType } from '../storage';
import { getSvgString } from '../tagSvg';
import { FEATURE_CATEGORIES } from '../featureCategories';
import { fetchOsmContext, isSignificantHighway, type OsmContext, type OsmPlaceLabel, type OsmRoad, type OsmWater } from './osmContext';

/**
 * A4 landscape @ 200 DPI → download-ready print file.
 * 297mm × 210mm. Same layout scales cleanly to A2 when printed larger.
 */
const PAGE_W = 2339;
const PAGE_H = 1654;
const MARGIN = 40;
const TITLE_H = 70;
const LEGEND_H = 188;
/** Empty gap between map frame and title / legend (user: ≥4px). */
const SECTION_GAP = 8;
const ICON_MAP_MAX = 40;
const ICON_MAP_MIN = 26;
const ICON_LEGEND = 26;
/** Boundary fills the frame (max zoom). Outside landmarks are edge-labels — not zoom-out. */
const AOI_FILL = 0.97;

type Pt = { x: number; y: number };

type Projector = {
  toCanvas: (c: Coordinate) => Pt;
  content: { x: number; y: number; w: number; h: number };
};

const PAPER = '#faf9f5';
const INK = '#1f1f1f';
const BOUNDARY = '#1f1f1f';
const ROAD_OUTER = '#1f1f1f';
const ROAD_INNER = '#faf9f5';
const OSM_ROAD = '#4a4a4a';

let svgSeq = 0;

/** Make pattern ids unique so hatched icons don’t clash on one canvas. */
const uniquifySvg = (svg: string): string => {
  const id = `hlb${++svgSeq}`;
  return svg
    .replace(/id="diagonalHatch"/g, `id="diagonalHatch-${id}"`)
    .replace(/url\(#diagonalHatch\)/g, `url(#diagonalHatch-${id})`);
};

const loadSvgImage = (svg: string, size: number): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const prepared = uniquifySvg(svg).replace(
      /<svg\b/i,
      `<svg width="${size}" height="${size}"`
    );
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(prepared)}`;
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG icon failed to load'));
    img.src = url;
  });

const iconCache = new Map<string, Promise<HTMLImageElement | null>>();

const getIconImage = (type: TagType, subType: string, size: number): Promise<HTMLImageElement | null> => {
  const key = `${type}:${subType}:${size}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const svg = getSvgString(type, subType);
    if (!svg) return null;
    try {
      return await loadSvgImage(svg, size);
    } catch {
      return null;
    }
  })();

  iconCache.set(key, promise);
  return promise;
};

/** Fallback outline so house numbers never float without a square. */
const drawFallbackIcon = (
  ctx: CanvasRenderingContext2D,
  type: TagType,
  subType: string,
  x: number,
  y: number,
  size: number
) => {
  const half = size / 2;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = PAPER;
  ctx.lineWidth = Math.max(1.5, size * 0.08);
  ctx.lineJoin = 'round';

  if (type === 'Badbuilding') {
    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x + half, y + half);
    ctx.lineTo(x - half, y + half);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(x - half, y - half, size, size);
    ctx.strokeRect(x - half, y - half, size, size);
    if (subType.includes('non-residential')) {
      ctx.beginPath();
      ctx.moveTo(x - half, y - half);
      ctx.lineTo(x + half, y + half);
      ctx.moveTo(x + half, y - half);
      ctx.lineTo(x - half, y + half);
      ctx.stroke();
    }
  }
  ctx.restore();
};

const drawIcon = async (
  ctx: CanvasRenderingContext2D,
  type: TagType,
  subType: string,
  x: number,
  y: number,
  size: number
) => {
  const img = await getIconImage(type, subType, size);
  if (img) {
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    return;
  }
  drawFallbackIcon(ctx, type, subType, x, y, size);
};

/** Keep OSM geometry near the HLB AOI (works for any user upload). */
const nearAoi = (coord: Coordinate, boundary: Coordinate[], factor = 0.35): boolean => {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const c of boundary) {
    minLat = Math.min(minLat, c.lat);
    maxLat = Math.max(maxLat, c.lat);
    minLng = Math.min(minLng, c.lng);
    maxLng = Math.max(maxLng, c.lng);
  }
  const latPad = (maxLat - minLat) * factor;
  const lngPad = (maxLng - minLng) * factor;
  return (
    coord.lat >= minLat - latPad &&
    coord.lat <= maxLat + latPad &&
    coord.lng >= minLng - lngPad &&
    coord.lng <= maxLng + lngPad
  );
};

const roadNearAoi = (road: OsmRoad, boundary: Coordinate[]): boolean =>
  road.coordinates.some((c) => nearAoi(c, boundary, 0.85));

const waterNearAoi = (water: OsmWater, boundary: Coordinate[]): boolean =>
  water.coordinates.some((c) => nearAoi(c, boundary, 1.0));

const collectAoiCoords = (project: CensusProject): Coordinate[] => {
  if (project.boundary.length >= 3) return project.boundary;
  const coords: Coordinate[] = [];
  for (const f of project.features) {
    if (f.geometry.type === 'Point') coords.push(f.geometry.coordinates);
    else coords.push(...f.geometry.coordinates);
  }
  return coords;
};

/**
 * Max-zoom fit to the HLB boundary only.
 * Outside schools/ponds/roads are labelled on the edge — they must NOT shrink this zoom.
 */
const buildProjector = (project: CensusProject): Projector => {
  const coords = collectAoiCoords(project);
  const content = {
    x: MARGIN,
    y: MARGIN + TITLE_H + SECTION_GAP,
    w: PAGE_W - MARGIN * 2,
    h: PAGE_H - MARGIN * 2 - TITLE_H - LEGEND_H - SECTION_GAP * 2,
  };

  if (coords.length === 0) {
    return {
      toCanvas: () => ({ x: PAGE_W / 2, y: PAGE_H / 2 }),
      content,
    };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const c of coords) {
    minLat = Math.min(minLat, c.lat);
    maxLat = Math.max(maxLat, c.lat);
    minLng = Math.min(minLng, c.lng);
    maxLng = Math.max(maxLng, c.lng);
  }

  // Tiny pad only — keep the block max-zoomed
  const latPad = Math.max((maxLat - minLat) * 0.02, 0.00004);
  const lngPad = Math.max((maxLng - minLng) * 0.02, 0.00004);
  minLat -= latPad;
  maxLat += latPad;
  minLng -= lngPad;
  maxLng += lngPad;

  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const geoW = (maxLng - minLng) * Math.cos(midLat);
  const geoH = maxLat - minLat;

  const fitScale = Math.min(content.w / Math.max(geoW, 1e-9), content.h / Math.max(geoH, 1e-9));
  const scale = fitScale * AOI_FILL;
  const usedW = geoW * scale;
  const usedH = geoH * scale;
  const ox = content.x + (content.w - usedW) / 2;
  const oy = content.y + (content.h - usedH) / 2;

  return {
    content,
    toCanvas: (c: Coordinate) => ({
      x: ox + (c.lng - minLng) * Math.cos(midLat) * scale,
      y: oy + (maxLat - c.lat) * scale,
    }),
  };
};

/** Shrink icons when houses are dense so they don’t stack (works for any upload). */
const computeIconSize = (
  points: CensusFeature[],
  toCanvas: (c: Coordinate) => Pt
): number => {
  const pts = points
    .filter((f) => f.geometry.type === 'Point')
    .map((f) => toCanvas((f.geometry as { type: 'Point'; coordinates: Coordinate }).coordinates));
  if (pts.length < 2) return ICON_MAP_MAX;

  let minDist = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      if (d > 0.5) minDist = Math.min(minDist, d);
    }
  }
  if (!Number.isFinite(minDist)) return ICON_MAP_MAX;
  // Keep squares clearly visible; numbers sit inside them
  return Math.max(ICON_MAP_MIN, Math.min(ICON_MAP_MAX, Math.floor(minDist * 0.78)));
};

const strokePolyline = (
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  opts: { color: string; width: number; dash?: number[]; lineCap?: CanvasLineCap }
) => {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = opts.color;
  ctx.lineWidth = opts.width;
  ctx.lineJoin = 'round';
  ctx.lineCap = opts.lineCap ?? 'round';
  ctx.setLineDash(opts.dash ?? []);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
};

const drawDoubleRoad = (ctx: CanvasRenderingContext2D, pts: Pt[], subType: string) => {
  if (pts.length < 2) return;
  const isPath = subType === 'path';
  const isBad = subType === 'bad_road';
  const isRail = subType === 'railway';

  if (isRail) {
    strokePolyline(ctx, pts, { color: INK, width: 6 });
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      for (let t = 0; t < 1; t += 12 / len) {
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        ctx.beginPath();
        ctx.moveTo(x + nx * 6, y + ny * 6);
        ctx.lineTo(x - nx * 6, y - ny * 6);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  if (isPath) {
    strokePolyline(ctx, pts, { color: INK, width: 3, dash: [12, 9] });
    return;
  }

  strokePolyline(ctx, pts, { color: ROAD_OUTER, width: isBad ? 9 : 11 });
  strokePolyline(ctx, pts, {
    color: ROAD_INNER,
    width: isBad ? 4 : 5.5,
    dash: isBad ? [10, 7] : undefined,
  });
  if (!isBad) {
    strokePolyline(ctx, pts, { color: ROAD_OUTER, width: 1.5 });
  }
};

/** OSM basemap roads (not user-tagged) — thinner so enumerator roads stay primary. */
const drawOsmRoad = (ctx: CanvasRenderingContext2D, pts: Pt[], highway?: string) => {
  if (pts.length < 2) return;
  const major = /primary|secondary|trunk|tertiary|motorway/.test(highway ?? '');
  const pathLike = /path|footway|track|cycleway|steps/.test(highway ?? '');

  if (pathLike) {
    strokePolyline(ctx, pts, { color: OSM_ROAD, width: 1.8, dash: [8, 6] });
    return;
  }

  if (major) {
    strokePolyline(ctx, pts, { color: OSM_ROAD, width: 7 });
    strokePolyline(ctx, pts, { color: PAPER, width: 3.5 });
    strokePolyline(ctx, pts, { color: OSM_ROAD, width: 1.2 });
    return;
  }

  strokePolyline(ctx, pts, { color: OSM_ROAD, width: 5 });
  strokePolyline(ctx, pts, { color: PAPER, width: 2.5 });
};

/** OSM water (river / pond outline) — light blue Census style. */
const drawOsmWater = (ctx: CanvasRenderingContext2D, pts: Pt[], kind?: string) => {
  if (pts.length < 2) return;
  const closed = /pond|lake|reservoir|basin|water/i.test(kind ?? '') && pts.length >= 3;
  ctx.save();
  ctx.strokeStyle = '#4a90b8';
  ctx.fillStyle = 'rgba(74, 144, 184, 0.12)';
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (closed) {
    ctx.closePath();
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
};

/** Google Open Buildings footprints — soft orange fill matching map overlay. */
const drawBuildingFootprint = (ctx: CanvasRenderingContext2D, pts: Pt[]) => {
  if (pts.length < 3) return;
  ctx.save();
  ctx.strokeStyle = '#ea580c';
  ctx.fillStyle = 'rgba(251, 146, 60, 0.28)';
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

/** OSM forest / woodland — soft green fill matching map overlay. */
const drawForest = (ctx: CanvasRenderingContext2D, pts: Pt[]) => {
  if (pts.length < 3) return;
  ctx.save();
  ctx.strokeStyle = '#166534';
  ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

/** Dotted black HLB outline — no vertex numbers (Census sheet style). */
const drawBoundary = (ctx: CanvasRenderingContext2D, pts: Pt[]) => {
  if (pts.length < 3) return;
  const closed = [...pts, pts[0]];
  strokePolyline(ctx, closed, {
    color: BOUNDARY,
    width: 3.5,
    dash: [2, 6],
    lineCap: 'round',
  });
};

const MAP_FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const LABEL_INK = '#3d3429';
const LABEL_WATER = '#4a90b8';

type LabelBox = { x: number; y: number; w: number; h: number };

const boxesOverlap = (a: LabelBox, b: LabelBox, pad = 4) =>
  !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  );

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const trial = `${line} ${words[i]}`;
    if (ctx.measureText(trial).width <= maxWidth) {
      line = trial;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines.slice(0, 3);
};

const drawMapLabel = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  occupied: LabelBox[],
  opts?: {
    fontSize?: number;
    color?: string;
    align?: CanvasTextAlign;
    maxWidth?: number;
    italic?: boolean;
  }
): boolean => {
  const fontSize = opts?.fontSize ?? 13;
  const maxWidth = opts?.maxWidth ?? 220;
  const align = opts?.align ?? 'left';
  const color = opts?.color ?? LABEL_INK;
  const italic = opts?.italic ? 'italic ' : '';

  ctx.save();
  ctx.font = `${italic}${fontSize}px ${MAP_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  const lines = wrapLines(ctx, text, maxWidth);
  if (!lines.length) {
    ctx.restore();
    return false;
  }

  const lineH = fontSize + 3;
  const widths = lines.map((l) => ctx.measureText(l).width);
  const blockW = Math.max(...widths);
  const blockH = lines.length * lineH;

  // Candidate offsets — prefer right of point, then above/below (map-like breathing room)
  const candidates: Array<{ ox: number; oy: number }> = [
    { ox: 8, oy: -blockH / 2 },
    { ox: 8, oy: -blockH - 6 },
    { ox: 8, oy: 8 },
    { ox: -blockW - 8, oy: -blockH / 2 },
    { ox: -blockW / 2, oy: -blockH - 10 },
    { ox: -blockW / 2, oy: 12 },
    { ox: 14, oy: -blockH - 18 },
    { ox: 14, oy: 18 },
  ];

  let placed: LabelBox | null = null;
  let origin = { x: x + 8, y: y - blockH / 2 };

  for (const c of candidates) {
    let left = x + c.ox;
    if (align === 'center') left = x + c.ox - blockW / 2;
    if (align === 'right') left = x + c.ox - blockW;
    const top = y + c.oy;
    const box: LabelBox = { x: left, y: top, w: blockW, h: blockH };
    if (occupied.some((o) => boxesOverlap(box, o))) continue;
    // Keep labels inside the map frame (below title gap, above legend gap)
    const mapTop = MARGIN + TITLE_H + SECTION_GAP;
    const mapBottom = PAGE_H - MARGIN - LEGEND_H - SECTION_GAP;
    if (box.x < MARGIN || box.y < mapTop || box.x + box.w > PAGE_W - MARGIN) continue;
    if (box.y + box.h > mapBottom) continue;
    placed = box;
    origin = { x: left, y: top };
    break;
  }

  if (!placed) {
    ctx.restore();
    return false;
  }

  occupied.push(placed);

  for (let i = 0; i < lines.length; i++) {
    const lx = align === 'center' ? origin.x + blockW / 2 : align === 'right' ? origin.x + blockW : origin.x;
    const ly = origin.y + i * lineH;
    ctx.lineWidth = 3;
    ctx.strokeStyle = PAPER;
    ctx.lineJoin = 'round';
    ctx.strokeText(lines[i], lx, ly);
    ctx.fillStyle = color;
    ctx.fillText(lines[i], lx, ly);
  }

  ctx.restore();
  return true;
};

const reserveIconBoxes = (
  occupied: LabelBox[],
  points: CensusFeature[],
  toCanvas: (c: Coordinate) => Pt,
  iconSize: number
) => {
  for (const f of points) {
    if (f.geometry.type !== 'Point') continue;
    const p = toCanvas(f.geometry.coordinates);
    const scale = Math.min(2.5, Math.max(0.7, Number(f.properties.iconScale) || 1));
    const size = iconSize * scale;
    occupied.push({
      x: p.x - size / 2 - 2,
      y: p.y - size / 2 - 2,
      w: size + 4,
      h: size + 4,
    });
  }
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const pointInRect = (
  p: Pt,
  r: { x: number; y: number; w: number; h: number },
  pad = 0
) =>
  p.x >= r.x + pad &&
  p.x <= r.x + r.w - pad &&
  p.y >= r.y + pad &&
  p.y <= r.y + r.h - pad;

/** Closest point on a closed/open polyline to p. */
const nearestOnRing = (p: Pt, ring: Pt[]): Pt => {
  if (!ring.length) return p;
  let best = ring[0];
  let bestD = Infinity;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
    const q = { x: a.x + dx * t, y: a.y + dy * t };
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
};

/**
 * Census-style outside labels: keep max zoom; pin landmark names just outside
 * the dotted boundary (toward the real place), clamped into the map frame.
 */
const outsideLabelAnchor = (
  geo: Coordinate,
  toCanvas: (c: Coordinate) => Pt,
  boundaryPts: Pt[],
  content: { x: number; y: number; w: number; h: number }
): Pt => {
  const raw = toCanvas(geo);
  const pad = 14;

  // Still inside the map frame and not far past the boundary → use true spot
  if (boundaryPts.length >= 3) {
    const onEdge = nearestOnRing(raw, boundaryPts);
    const distToEdge = Math.hypot(raw.x - onEdge.x, raw.y - onEdge.y);
    // Inside or hugging the boundary: keep geographic position
    if (pointInRect(raw, content, pad) && distToEdge < 28) {
      return raw;
    }
  } else if (pointInRect(raw, content, pad)) {
    return raw;
  }

  // Outside (or projected off-sheet): sit just outside the boundary toward the landmark
  let cx = content.x + content.w / 2;
  let cy = content.y + content.h / 2;
  if (boundaryPts.length) {
    cx = boundaryPts.reduce((s, p) => s + p.x, 0) / boundaryPts.length;
    cy = boundaryPts.reduce((s, p) => s + p.y, 0) / boundaryPts.length;
  }

  const onEdge = boundaryPts.length >= 3 ? nearestOnRing(raw, boundaryPts) : raw;
  let dx = raw.x - cx;
  let dy = raw.y - cy;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;

  let x = onEdge.x + dx * 18;
  let y = onEdge.y + dy * 18;
  x = clamp(x, content.x + pad, content.x + content.w - pad);
  y = clamp(y, content.y + pad, content.y + content.h - pad);
  return { x, y };
};

const drawPlaceLabels = (
  ctx: CanvasRenderingContext2D,
  places: OsmPlaceLabel[],
  toCanvas: (c: Coordinate) => Pt,
  boundaryPts: Pt[],
  content: { x: number; y: number; w: number; h: number },
  occupied: LabelBox[]
) => {
  const sorted = [...places].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || b.name.length - a.name.length
  );
  for (const place of sorted) {
    const p = outsideLabelAnchor(place.coordinate, toCanvas, boundaryPts, content);
    const isWater = /water|pond|lake|river|kulam|sea|bay|canal/i.test(
      `${place.kind} ${place.name}`
    );
    const important = (place.priority ?? 0) >= 80;
    drawMapLabel(ctx, place.name, p.x, p.y, occupied, {
      fontSize: important ? 14 : 12,
      maxWidth: important ? 240 : 180,
      color: isWater ? LABEL_WATER : LABEL_INK,
      italic: isWater,
    });
  }
};

const drawWaterLabels = (
  ctx: CanvasRenderingContext2D,
  waters: OsmWater[],
  toCanvas: (c: Coordinate) => Pt,
  boundaryPts: Pt[],
  content: { x: number; y: number; w: number; h: number },
  occupied: LabelBox[]
) => {
  for (const water of waters) {
    const name = water.name?.trim();
    if (!name || water.coordinates.length < 2) continue;
    const mid = water.coordinates[Math.floor(water.coordinates.length / 2)];
    const p = outsideLabelAnchor(mid, toCanvas, boundaryPts, content);
    drawMapLabel(ctx, name, p.x, p.y, occupied, {
      fontSize: 13,
      maxWidth: 200,
      color: LABEL_WATER,
      italic: true,
      align: 'center',
    });
  }
};

const drawOsmRoadLabels = (
  ctx: CanvasRenderingContext2D,
  roads: OsmRoad[],
  toCanvas: (c: Coordinate) => Pt,
  boundaryPts: Pt[],
  content: { x: number; y: number; w: number; h: number },
  occupied: LabelBox[]
) => {
  const named = roads
    .filter(
      (r) =>
        r.name &&
        r.coordinates.length >= 2 &&
        isSignificantHighway(r.highway)
    )
    .sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0));

  let drawn = 0;
  for (const road of named) {
    if (drawn >= 16) break;
    const midGeo = road.coordinates[Math.floor(road.coordinates.length / 2)];
    const raw = toCanvas(midGeo);
    // Label on geometry if visible; else edge-pin so named roads outside still show
    const p = pointInRect(raw, content, 8)
      ? raw
      : outsideLabelAnchor(midGeo, toCanvas, boundaryPts, content);
    const ok = drawMapLabel(ctx, road.name!, p.x, p.y, occupied, {
      fontSize: 12,
      align: 'center',
      maxWidth: 180,
      color: LABEL_INK,
    });
    if (ok) drawn += 1;
  }
};

const drawNorthArrow = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(8, 10);
  ctx.lineTo(0, 4);
  ctx.lineTo(-8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.font = `bold 14px ${MAP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', 0, -26);
  ctx.restore();
};

const drawTitle = (ctx: CanvasRenderingContext2D, _project: CensusProject) => {
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, PAGE_W, MARGIN + TITLE_H + SECTION_GAP);
  ctx.fillStyle = INK;
  ctx.font = `bold 26px ${MAP_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('HLB Map — Census 2027', MARGIN, MARGIN + 32);
  ctx.restore();
};

type LegendEntry = { type: TagType; subType: string; label: string };

const LEGEND_ENTRIES: LegendEntry[] = (
  Object.entries(FEATURE_CATEGORIES) as Array<
    [TagType, (typeof FEATURE_CATEGORIES)[TagType]]
  >
).flatMap(([type, cat]) =>
  cat.subTypes.map((sub) => ({
    type,
    subType: sub.id,
    label:
      type === 'Badbuilding'
        ? `മോശപ്പെട്ട ${sub.labelMl}`
        : type === 'GoodBuilding'
          ? `${sub.labelMl} കെട്ടിടം`
          : sub.labelMl,
  }))
);

const drawLegend = async (ctx: CanvasRenderingContext2D) => {
  const y0 = PAGE_H - MARGIN - LEGEND_H;
  const boxW = PAGE_W - MARGIN * 2;

  // Clear any map bleed into the legend band
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, y0 - SECTION_GAP, PAGE_W, LEGEND_H + MARGIN + SECTION_GAP);

  ctx.strokeStyle = '#cfcfcf';
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN, y0, boxW, LEGEND_H - 4);
  ctx.fillStyle = INK;
  ctx.font = `bold 15px ${MAP_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('സൂചിക', MARGIN + 16, y0 + 26);

  const items: Array<{
    label: string;
    draw: (cx: number, cy: number) => void | Promise<void>;
  }> = [
    ...LEGEND_ENTRIES.map((e) => ({
      label: e.label,
      draw: async (cx: number, cy: number) => {
        await drawIcon(ctx, e.type, e.subType, cx, cy, ICON_LEGEND);
      },
    })),
    {
      label: 'അതിർത്തി',
      draw: (cx: number, cy: number) => {
        ctx.save();
        ctx.strokeStyle = BOUNDARY;
        ctx.lineWidth = 3;
        ctx.setLineDash([2, 5]);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy);
        ctx.lineTo(cx + 14, cy);
        ctx.stroke();
        ctx.restore();
      },
    },
  ];

  const cols = 8;
  const rows = Math.ceil(items.length / cols);
  const colW = (boxW - 28) / cols;
  const rowH = (LEGEND_H - 44) / Math.max(rows, 1);

  for (let i = 0; i < items.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + 22 + col * colW;
    const y = y0 + 48 + row * rowH + rowH * 0.35;
    await items[i].draw(x, y);
    ctx.fillStyle = INK;
    ctx.font = `12px ${MAP_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(items[i].label, x + ICON_LEGEND / 2 + 6, y);
  }

  ctx.restore();
};

const featureLabel = (f: CensusFeature): string | undefined => f.properties.label?.trim() || undefined;

/**
 * Vector HLB map — A4 landscape PNG.
 * Icons from TagIcons; OSM roads + outside place-names for Census labelling.
 * Auto-fetched buildings / OSM layers match map visibility (WYSIWYG).
 */
export async function renderHlbMap(project: CensusProject): Promise<string> {
  if (project.boundary.length < 3) {
    throw new Error('Confirm a boundary with at least 3 points before generating an HLB map.');
  }

  iconCache.clear();
  svgSeq = 0;

  const auto = project.autoFetchLayers;
  const showBuildings = Boolean(auto?.buildings?.fetched && auto.buildings.visible);
  const showAutoOsm = Boolean(auto?.osmContext?.fetched && auto.osmContext.visible);
  const hideAutoOsm = Boolean(auto?.osmContext?.fetched && !auto.osmContext.visible);

  let osm: OsmContext = { roads: [], places: [], waters: [] };
  let forests: Array<{ id: string; name?: string; coordinates: Coordinate[] }> = [];

  if (showAutoOsm && auto?.osmContext) {
    // Use layers the enumerator kept visible on the map
    osm = {
      roads: auto.osmContext.roads,
      places: auto.osmContext.landmarks,
      waters: auto.osmContext.waters,
    };
    forests = auto.osmContext.forests;
  } else if (!hideAutoOsm) {
    // Never fetched (or not toggled off) — keep classic HLB OSM context fetch
    try {
      osm = await fetchOsmContext(project.boundary);
    } catch (err) {
      console.warn('OSM context unavailable — drawing enumerator features only', err);
    }
  }
  // hideAutoOsm: user fetched then hid roads/landmarks — omit from canvas

  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Max zoom on boundary only — outside landmarks are edge labels (do not zoom out)
  const projector = buildProjector(project);
  const { content } = projector;

  // Title + north live in the chrome band (never under map lines)
  drawTitle(ctx, project);
  drawNorthArrow(ctx, PAGE_W - MARGIN - 36, MARGIN + TITLE_H / 2 + 4);

  // Significant places nearby (labels pin to boundary edge if outside the zoomed frame)
  const osmPlaces = osm.places.filter(
    (p) => (p.priority ?? 0) >= 80 && nearAoi(p.coordinate, project.boundary, 1.5)
  );
  const osmRoads = osm.roads.filter(
    (r) =>
      roadNearAoi(r, project.boundary) &&
      (isSignificantHighway(r.highway) || Boolean(r.name))
  );
  const osmWaters = osm.waters.filter((w) => waterNearAoi(w, project.boundary));
  const occupied: LabelBox[] = [];
  const boundaryPts = project.boundary.map(projector.toCanvas);

  // Clip all map geometry so roads/boundary never bleed into title or legend
  ctx.save();
  ctx.beginPath();
  ctx.rect(content.x, content.y, content.w, content.h);
  ctx.clip();

  // 0) Auto-fetched Google buildings (only if visible on map)
  if (showBuildings && auto?.buildings?.footprints?.length) {
    for (const building of auto.buildings.footprints) {
      drawBuildingFootprint(ctx, building.ring.map(projector.toCanvas));
    }
  }

  // 0b) Forests from auto OSM (when kept visible)
  for (const forest of forests) {
    drawForest(ctx, forest.coordinates.map(projector.toCanvas));
  }

  // 1) Water bodies (ponds / rivers) — only parts that fall inside the zoomed frame
  for (const water of osmWaters) {
    drawOsmWater(ctx, water.coordinates.map(projector.toCanvas), water.kind);
  }

  // 2) Significant OSM roads near the AOI
  for (const road of osmRoads) {
    const pts = road.coordinates.map(projector.toCanvas);
    drawOsmRoad(ctx, pts, road.highway);
  }

  // 3) Enumerator roads (primary)
  const roads = project.features.filter((f) => f.type === 'roads' && f.geometry.type === 'LineString');
  const points = project.features.filter((f) => f.geometry.type === 'Point');
  const iconSize = computeIconSize(points, projector.toCanvas);

  for (const road of roads) {
    if (road.geometry.type !== 'LineString') continue;
    const pts = road.geometry.coordinates.map(projector.toCanvas);
    drawDoubleRoad(ctx, pts, road.subType);
  }

  // 4) Boundary — dotted black, no numbers
  drawBoundary(ctx, boundaryPts);

  // Reserve tag icon boxes so place/road names never cover house symbols
  reserveIconBoxes(occupied, points, projector.toCanvas, iconSize);

  // 5) Surrounding labels — edge-pinned when outside (max zoom preserved)
  drawWaterLabels(ctx, osmWaters, projector.toCanvas, boundaryPts, content, occupied);
  drawPlaceLabels(ctx, osmPlaces, projector.toCanvas, boundaryPts, content, occupied);
  drawOsmRoadLabels(ctx, osmRoads, projector.toCanvas, boundaryPts, content, occupied);
  for (const road of roads) {
    if (road.geometry.type !== 'LineString') continue;
    const label = featureLabel(road);
    if (!label) continue;
    const pts = road.geometry.coordinates.map(projector.toCanvas);
    if (pts.length < 2) continue;
    const mid = pts[Math.floor(pts.length / 2)];
    drawMapLabel(ctx, label, mid.x, mid.y, occupied, {
      fontSize: 12,
      align: 'center',
      maxWidth: 160,
      color: LABEL_INK,
    });
  }

  // 6) Tags — house numbers centered INSIDE icons (iconScale from editor)
  for (const f of points) {
    if (f.geometry.type !== 'Point') continue;
    const p = projector.toCanvas(f.geometry.coordinates);
    const scale = Math.min(2.5, Math.max(0.7, Number(f.properties.iconScale) || 1));
    const size = Math.round(iconSize * scale);
    await drawIcon(ctx, f.type, f.subType, p.x, p.y, size);
    const label = featureLabel(f);
    if (label) {
      const fontPx = Math.max(
        11,
        Math.min(Math.floor(size * 0.38), Math.floor((size * 0.85) / Math.max(label.length * 0.55, 1)))
      );
      ctx.save();
      ctx.font = `bold ${fontPx}px ${MAP_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, fontPx * 0.28);
      ctx.strokeStyle = '#111';
      ctx.strokeText(label, p.x, p.y);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, p.x, p.y);
      ctx.restore();
    }
  }

  ctx.restore(); // end map clip

  // Re-paint chrome so any anti-alias bleed is covered; keep ≥ SECTION_GAP empty
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, PAGE_W, content.y);
  ctx.fillRect(0, content.y + content.h, PAGE_W, PAGE_H - (content.y + content.h));
  drawTitle(ctx, project);
  drawNorthArrow(ctx, PAGE_W - MARGIN - 36, MARGIN + TITLE_H / 2 + 4);
  await drawLegend(ctx);

  return canvas.toDataURL('image/png');
}

export const HLB_PAGE = {
  format: 'A4 landscape',
  widthPx: PAGE_W,
  heightPx: PAGE_H,
  dpi: 200,
  note: 'Print larger on A2 — same landscape layout, less empty margin.',
} as const;
