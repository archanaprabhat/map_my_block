import localforage from 'localforage';
import { SKETCH_SOURCE_KEY } from './keys';
import type { SketchOverlay } from './sketchPipeline';

const OVERLAY_KEY = 'map-my-block-sketch-overlay';

/** In-memory handoff for large PNG data URLs (sessionStorage often exceeds quota). */
let memorySource: string | null = null;
let memoryOverlay: SketchOverlay | null = null;

const sketchStore = localforage.createInstance({
  name: 'map-my-block-sketch',
  storeName: 'transfer',
});

export async function setSketchSource(
  dataUrl: string,
  overlay: SketchOverlay | null = null
): Promise<void> {
  memorySource = dataUrl;
  memoryOverlay = overlay;
  try {
    await sketchStore.setItem(SKETCH_SOURCE_KEY, dataUrl);
    await sketchStore.setItem(OVERLAY_KEY, overlay);
  } catch (err) {
    console.warn('Could not persist sketch source to IndexedDB', err);
  }
}

export async function getSketchSource(): Promise<string | null> {
  if (memorySource) return memorySource;
  try {
    const stored = await sketchStore.getItem<string>(SKETCH_SOURCE_KEY);
    if (stored) {
      memorySource = stored;
      return stored;
    }
  } catch (err) {
    console.warn('Could not read sketch source from IndexedDB', err);
  }
  return null;
}

export async function getSketchOverlay(): Promise<SketchOverlay | null> {
  if (memoryOverlay) return memoryOverlay;
  try {
    const stored = await sketchStore.getItem<SketchOverlay>(OVERLAY_KEY);
    if (stored) {
      memoryOverlay = stored;
      return stored;
    }
  } catch (err) {
    console.warn('Could not read sketch overlay from IndexedDB', err);
  }
  return null;
}

export async function clearSketchResult(): Promise<void> {
  try {
    await sketchStore.removeItem('map-my-block-sketch-result');
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('map-my-block-sketch-result');
  }
}
