/// <reference lib="webworker" />

import { SKETCH_PARAMS, SketchOverlay } from '../lib/sketch/sketchPipeline';

type SketchRequest = {
  type: 'sketch';
  id: string;
  dataUrl: string;
  maxWidth?: number;
  overlay?: SketchOverlay | null;
};

type OutMessage =
  | { type: 'ready' }
  | { type: 'success'; id: string; dataUrl: string }
  | { type: 'error'; id: string; message: string }
  | { type: 'progress'; id: string; percent: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CvModule = any;

declare const self: DedicatedWorkerGlobalScope & { cv?: CvModule };

let cvReady: CvModule | null = null;
let initPromise: Promise<CvModule> | null = null;

const post = (message: OutMessage) => {
  self.postMessage(message);
};

const loadOpenCv = async (): Promise<CvModule> => {
  if (cvReady) return cvReady;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    self.importScripts('/opencv/opencv.js');

    const cvModule = self.cv;
    if (!cvModule) throw new Error('OpenCV failed to load');

    if (cvModule instanceof Promise) {
      cvReady = await cvModule;
    } else if (cvModule.Mat) {
      cvReady = cvModule;
    } else {
      await new Promise<void>((resolve, reject) => {
        const timeout = self.setTimeout(() => reject(new Error('OpenCV init timed out')), 60000);
        cvModule.onRuntimeInitialized = () => {
          self.clearTimeout(timeout);
          resolve();
        };
      });
      cvReady = cvModule;
    }

    post({ type: 'ready' });
    return cvReady!;
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
};

const dataUrlToMat = async (cv: CvModule, dataUrl: string): Promise<CvModule> => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return cv.matFromImageData(imageData);
  } finally {
    bitmap.close();
  }
};

const matToPngDataUrl = async (cv: CvModule, mat: CvModule): Promise<string> => {
  let rgba = mat;
  let converted: CvModule | null = null;

  try {
    if (mat.type() === cv.CV_8UC3) {
      converted = new cv.Mat();
      cv.cvtColor(mat, converted, cv.COLOR_BGR2RGBA);
      rgba = converted;
    } else if (mat.type() === cv.CV_8UC1) {
      converted = new cv.Mat();
      cv.cvtColor(mat, converted, cv.COLOR_GRAY2RGBA);
      rgba = converted;
    } else if (mat.channels() === 4) {
      rgba = mat;
    } else {
      throw new Error(`Unsupported mat type for export: channels=${mat.channels()}`);
    }

    const width = rgba.cols as number;
    const height = rgba.rows as number;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');

    const clamped = new Uint8ClampedArray(rgba.data.byteLength);
    clamped.set(rgba.data as Uint8Array);
    ctx.putImageData(new ImageData(clamped, width, height), 0, 0);

    const outBlob = await canvas.convertToBlob({ type: 'image/png' });
    const buffer = await outBlob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x2000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
    }
    return `data:image/png;base64,${btoa(binary)}`;
  } finally {
    if (converted) converted.delete();
  }
};

const scaleOverlay = (overlay: SketchOverlay, scale: number): SketchOverlay => ({
  ...overlay,
  boundary: overlay.boundary.map((p) => ({ x: p.x * scale, y: p.y * scale })),
  roads: overlay.roads.map((line) => line.map((p) => ({ x: p.x * scale, y: p.y * scale }))),
  points: overlay.points.map((p) => ({ ...p, x: p.x * scale, y: p.y * scale })),
  imageWidth: Math.round(overlay.imageWidth * scale),
  imageHeight: Math.round(overlay.imageHeight * scale),
});

const ptsToMat = (cv: CvModule, points: Array<{ x: number; y: number }>) => {
  const flat = points.map((p) => [p.x, p.y]);
  return cv.matFromArray(points.length, 1, cv.CV_32SC2, flat.flat());
};

/**
 * Line-art on white paper (not shaded satellite dump):
 * denoise → CLAHE → pencil → keep only strong dark strokes + Canny + roads.
 * Midtones are lifted to paper so the page stays light / “drawn”.
 */
const runSketch = (cv: CvModule, src: CvModule, maxWidth: number, overlay: SketchOverlay | null): CvModule => {
  const temps: CvModule[] = [];
  const track = (m: CvModule) => {
    temps.push(m);
    return m;
  };

  try {
    let working = src;
    let scale = 1;
    const longest = Math.max(src.cols, src.rows);
    if (longest > maxWidth) {
      scale = maxWidth / longest;
      const size = new cv.Size(Math.round(src.cols * scale), Math.round(src.rows * scale));
      const resized = track(new cv.Mat());
      cv.resize(src, resized, size, 0, 0, cv.INTER_AREA);
      working = resized;
    }

    const scaledOverlay = overlay ? scaleOverlay(overlay, scale) : null;

    const bgr = track(new cv.Mat());
    if (working.channels() === 4) {
      cv.cvtColor(working, bgr, cv.COLOR_RGBA2BGR);
    } else if (working.channels() === 3) {
      working.copyTo(bgr);
    } else {
      cv.cvtColor(working, bgr, cv.COLOR_GRAY2BGR);
    }

    const gray = track(new cv.Mat());
    cv.cvtColor(bgr, gray, cv.COLOR_BGR2GRAY);

    // Kill canopy speckles before edges
    const denoise = track(new cv.Mat());
    cv.GaussianBlur(gray, denoise, new cv.Size(0, 0), SKETCH_PARAMS.denoiseSigma);

    const clahe = new cv.CLAHE(
      SKETCH_PARAMS.claheClipLimit,
      new cv.Size(SKETCH_PARAMS.claheTiles, SKETCH_PARAMS.claheTiles)
    );
    const enhanced = track(new cv.Mat());
    clahe.apply(denoise, enhanced);
    clahe.delete();

    // Pencil dodge (structure)
    const inv = track(new cv.Mat());
    cv.bitwise_not(enhanced, inv);
    const blur = track(new cv.Mat());
    cv.GaussianBlur(inv, blur, new cv.Size(0, 0), SKETCH_PARAMS.pencilSigma);
    const denom = track(new cv.Mat());
    cv.bitwise_not(blur, denom);
    const pencil = track(new cv.Mat());
    cv.divide(enhanced, denom, pencil, 256);

    // Strong edges only (high thresholds = less foliage noise)
    const edges = track(new cv.Mat());
    cv.Canny(enhanced, edges, SKETCH_PARAMS.cannyLow, SKETCH_PARAMS.cannyHigh);
    const edgeKernel = cv.getStructuringElement(
      cv.MORPH_ELLIPSE,
      new cv.Size(SKETCH_PARAMS.edgeDilate, SKETCH_PARAMS.edgeDilate)
    );
    const thickEdges = track(new cv.Mat());
    cv.dilate(edges, thickEdges, edgeKernel);
    edgeKernel.delete();

    // Bright road / roof highlights
    const bright = track(new cv.Mat());
    cv.threshold(enhanced, bright, SKETCH_PARAMS.roadBrightnessMin, 255, cv.THRESH_BINARY);
    const roadKernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(SKETCH_PARAMS.roadMorphSize, SKETCH_PARAMS.roadMorphSize)
    );
    const roadsMask = track(new cv.Mat());
    cv.morphologyEx(bright, roadsMask, cv.MORPH_OPEN, roadKernel);
    roadKernel.delete();

    // Binary line mask on white paper — NO midtone gray fill
    const lineMask = track(cv.Mat.zeros(enhanced.rows, enhanced.cols, cv.CV_8UC1));
    const inkKeepBelow = SKETCH_PARAMS.inkKeepBelow;
    const paperLiftAbove = SKETCH_PARAMS.paperLiftAbove;

    for (let i = 0; i < lineMask.data.length; i++) {
      const tone = pencil.data[i];
      // Only the darkest pencil strokes become ink; midtones → paper (fixes dark fill)
      const isStrongStroke = tone < inkKeepBelow;
      const isEdge = thickEdges.data[i] > 0;
      const isRoad = roadsMask.data[i] > 0;
      if (isEdge || isRoad || isStrongStroke) {
        lineMask.data[i] = 255;
      }
    }
    // paperLiftAbove reserved for future soft-gray midtones; currently midtones = paper
    void paperLiftAbove;

    // Clean isolated speckles
    const cleanKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2, 2));
    const cleaned = track(new cv.Mat());
    cv.morphologyEx(lineMask, cleaned, cv.MORPH_OPEN, cleanKernel);
    cleanKernel.delete();

    const [pr, pg, pb] = SKETCH_PARAMS.paperRgb;
    const [ir, ig, ib] = SKETCH_PARAMS.inkRgb;
    const paper = track(new cv.Mat(cleaned.rows, cleaned.cols, cv.CV_8UC3, new cv.Scalar(pb, pg, pr)));
    const inkFill = track(new cv.Mat(cleaned.rows, cleaned.cols, cv.CV_8UC3, new cv.Scalar(ib, ig, ir)));
    const out = new cv.Mat();
    paper.copyTo(out);
    inkFill.copyTo(out, cleaned);

    // Mask everything outside the census boundary → paper white (AOI only)
    if (scaledOverlay && scaledOverlay.boundary.length >= 3) {
      const mask = track(cv.Mat.zeros(out.rows, out.cols, cv.CV_8UC1));
      const poly = ptsToMat(cv, scaledOverlay.boundary);
      const contours = new cv.MatVector();
      contours.push_back(poly);
      cv.fillPoly(mask, contours, new cv.Scalar(255));
      contours.delete();
      poly.delete();

      const outside = track(new cv.Mat());
      cv.bitwise_not(mask, outside);
      paper.copyTo(out, outside);

      // Strong boundary stroke
      const boundaryMat = ptsToMat(cv, [...scaledOverlay.boundary, scaledOverlay.boundary[0]]);
      const boundaryVec = new cv.MatVector();
      boundaryVec.push_back(boundaryMat);
      cv.polylines(out, boundaryVec, true, new cv.Scalar(ib, ig, ir), SKETCH_PARAMS.boundaryStroke, cv.LINE_AA);
      boundaryVec.delete();
      boundaryMat.delete();

      // Census roads
      for (const line of scaledOverlay.roads) {
        if (line.length < 2) continue;
        const lineMat = ptsToMat(cv, line);
        const lineVec = new cv.MatVector();
        lineVec.push_back(lineMat);
        cv.polylines(out, lineVec, false, new cv.Scalar(ib, ig, ir), 3, cv.LINE_AA);
        lineVec.delete();
        lineMat.delete();
      }

      // Tagged features
      for (const pt of scaledOverlay.points) {
        const x = Math.round(pt.x);
        const y = Math.round(pt.y);
        if (x < 0 || y < 0 || x >= out.cols || y >= out.rows) continue;

        if (pt.kind === 'residential') {
          const tri = ptsToMat(cv, [
            { x, y: y - 10 },
            { x: x - 9, y: y + 8 },
            { x: x + 9, y: y + 8 },
          ]);
          const tv = new cv.MatVector();
          tv.push_back(tri);
          cv.fillPoly(out, tv, new cv.Scalar(ib, ig, ir));
          tv.delete();
          tri.delete();
        } else if (pt.kind === 'nonResidential') {
          cv.rectangle(out, new cv.Point(x - 8, y - 8), new cv.Point(x + 8, y + 8), new cv.Scalar(ib, ig, ir), 2);
          cv.line(out, new cv.Point(x - 8, y - 8), new cv.Point(x + 8, y + 8), new cv.Scalar(ib, ig, ir), 1);
        } else if (pt.kind === 'religious') {
          cv.rectangle(out, new cv.Point(x - 7, y - 4), new cv.Point(x + 7, y + 9), new cv.Scalar(ib, ig, ir), 2);
          cv.line(out, new cv.Point(x, y - 12), new cv.Point(x, y - 4), new cv.Scalar(ib, ig, ir), 2);
          cv.line(out, new cv.Point(x - 5, y - 9), new cv.Point(x + 5, y - 9), new cv.Scalar(ib, ig, ir), 2);
        } else if (pt.kind === 'institution') {
          cv.rectangle(out, new cv.Point(x - 9, y - 9), new cv.Point(x + 9, y + 9), new cv.Scalar(ib, ig, ir), 2);
        } else if (pt.kind === 'water') {
          cv.circle(out, new cv.Point(x, y), 7, new cv.Scalar(ib, ig, ir), 2);
        } else {
          cv.circle(out, new cv.Point(x, y), 5, new cv.Scalar(ib, ig, ir), -1);
        }
      }

      const allX = scaledOverlay.boundary.map((p) => p.x);
      const allY = scaledOverlay.boundary.map((p) => p.y);
      const pad = SKETCH_PARAMS.cropPadding;
      const minX = Math.max(0, Math.floor(Math.min(...allX) - pad));
      const minY = Math.max(0, Math.floor(Math.min(...allY) - pad));
      const maxX = Math.min(out.cols, Math.ceil(Math.max(...allX) + pad));
      const maxY = Math.min(out.rows, Math.ceil(Math.max(...allY) + pad));
      const w = Math.max(1, maxX - minX);
      const h = Math.max(1, maxY - minY);
      const roi = out.roi(new cv.Rect(minX, minY, w, h));
      const cropped = roi.clone();
      roi.delete();
      out.delete();

      for (const m of temps) {
        try {
          m.delete();
        } catch {
          /* ignore */
        }
      }
      return cropped;
    }

    for (const m of temps) {
      try {
        m.delete();
      } catch {
        /* ignore */
      }
    }
    return out;
  } catch (err) {
    for (const m of temps) {
      try {
        m.delete();
      } catch {
        /* ignore */
      }
    }
    throw err;
  }
};

self.onmessage = async (event: MessageEvent<SketchRequest>) => {
  const msg = event.data;
  if (!msg || msg.type !== 'sketch') return;

  try {
    post({ type: 'progress', id: msg.id, percent: 5 });
    const cv = await loadOpenCv();
    post({ type: 'progress', id: msg.id, percent: 20 });

    const src = await dataUrlToMat(cv, msg.dataUrl);
    if (!src || src.empty()) throw new Error('Could not decode map image');

    post({ type: 'progress', id: msg.id, percent: 40 });
    const maxWidth = msg.maxWidth ?? SKETCH_PARAMS.maxWidth;
    const sketched = runSketch(cv, src, maxWidth, msg.overlay ?? null);
    src.delete();

    post({ type: 'progress', id: msg.id, percent: 85 });
    const dataUrl = await matToPngDataUrl(cv, sketched);
    sketched.delete();

    post({ type: 'success', id: msg.id, dataUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sketch failed';
    post({ type: 'error', id: msg.id, message });
  }
};

export {};
