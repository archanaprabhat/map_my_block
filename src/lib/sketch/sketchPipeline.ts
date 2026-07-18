/**
 * Tunable OpenCV sketch parameters (“temperature” / look knobs).
 *
 * WHY IT WAS DARK:
 * Satellite foliage is mid-dark gray. The old code pasted those midtones onto
 * the page as ink, so the whole AOI looked like a dark smear.
 *
 * FIX: treat the page as WHITE PAPER and only draw BLACK LINES where edges /
 * strong structure / roads exist. Midtones are discarded (lifted to paper).
 */

export const SKETCH_PARAMS = {
  /** Longest side of processing (px). Higher = more detail, slower. */
  maxWidth: 1600,

  // --- Brightness / “how white is the paper” ---
  /**
   * Pencil pixels BRIGHTER than this become pure paper (no ink).
   * ↑ Raise (e.g. 140→180) → lighter image, fewer gray fills.
   * ↓ Lower → more gray shading kept (darker look).
   */
  paperLiftAbove: 165,

  /**
   * Pencil pixels DARKER than this become solid ink strokes.
   * ↑ Raise → fewer ink strokes (cleaner, sparser drawing).
   * ↓ Lower → more ink (busier / darker line work).
   */
  inkKeepBelow: 95,

  /** Soft midtone band between inkKeepBelow and paperLiftAbove is discarded → paper. */

  // --- Contrast (CLAHE) ---
  /**
   * Local contrast boost before sketching.
   * ↑ Higher (4–6) → stronger local contrast (can amplify canopy noise).
   * ↓ Lower (1.5–2.5) → flatter, cleaner, lighter.
   */
  claheClipLimit: 2.0,
  claheTiles: 8,

  // --- Noise before edges ---
  /**
   * Blur canopy texture so Canny doesn’t draw every leaf as ink.
   * ↑ Higher sigma → smoother, fewer noisy dots.
   * ↓ Lower → more fine texture (often unwanted on satellite).
   */
  denoiseSigma: 1.4,

  // --- Pencil dodge ---
  /**
   * Gaussian sigma for classic pencil dodge.
   * ↑ Higher → softer, broader strokes.
   * ↓ Lower → tighter detail.
   */
  pencilSigma: 11,

  // --- Edge lines (the “drawn” look) ---
  /**
   * Canny low/high. Higher = only strong edges (roads, roofs, boundary).
   * Satellite foliage needs HIGH values or you get a dark speckled fill.
   */
  cannyLow: 60,
  cannyHigh: 160,
  /** Edge stroke thickness (dilate). 1–3 typical. */
  edgeDilate: 1,

  // --- Bright roads on satellite ---
  /** Min gray value treated as a road/path highlight. */
  roadBrightnessMin: 155,
  roadMorphSize: 3,

  // --- Geometry chrome ---
  cropPadding: 28,
  boundaryStroke: 4,

  /** Paper / ink colors (BGR used in OpenCV mats). */
  paperRgb: [250, 249, 245] as const,
  inkRgb: [32, 32, 32] as const,
} as const;

export type SketchPointPx = {
  x: number;
  y: number;
  kind: 'residential' | 'nonResidential' | 'religious' | 'institution' | 'water' | 'other';
  label?: string;
};

export type SketchOverlay = {
  boundary: Array<{ x: number; y: number }>;
  roads: Array<Array<{ x: number; y: number }>>;
  points: SketchPointPx[];
  imageWidth: number;
  imageHeight: number;
};
