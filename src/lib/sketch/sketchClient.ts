import { SKETCH_PARAMS, SketchOverlay } from './sketchPipeline';

type SketchRequest = {
  type: 'sketch';
  id: string;
  dataUrl: string;
  maxWidth?: number;
  overlay?: SketchOverlay | null;
};

type WorkerResponse =
  | { type: 'ready' }
  | { type: 'success'; id: string; dataUrl: string }
  | { type: 'error'; id: string; message: string }
  | { type: 'progress'; id: string; percent: number };

type Pending = {
  resolve: (dataUrl: string) => void;
  reject: (error: Error) => void;
  onProgress?: (percent: number) => void;
};

let worker: Worker | null = null;
const pending = new Map<string, Pending>();

const getWorker = () => {
  if (typeof window === 'undefined') {
    throw new Error('Sketch worker is browser-only');
  }
  if (worker) return worker;

  worker = new Worker(new URL('../../workers/sketch.worker.ts', import.meta.url));

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'ready') return;

    if (msg.type === 'progress') {
      pending.get(msg.id)?.onProgress?.(msg.percent);
      return;
    }

    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);

    if (msg.type === 'success') {
      entry.resolve(msg.dataUrl);
      return;
    }

    if (msg.type === 'error') {
      entry.reject(new Error(msg.message || 'Sketch failed'));
    }
  };

  worker.onerror = (event) => {
    const error = new Error(event.message || 'Sketch worker crashed');
    for (const [id, entry] of pending) {
      entry.reject(error);
      pending.delete(id);
    }
  };

  return worker;
};

export type CreateSketchOptions = {
  maxWidth?: number;
  overlay?: SketchOverlay | null;
  onProgress?: (percent: number) => void;
};

/** Run OpenCV sketch in a singleton Web Worker (OpenCV stays loaded after first use). */
export function createSketchFromDataUrl(
  sourceDataUrl: string,
  options: CreateSketchOptions = {}
): Promise<string> {
  const id = `sketch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const maxWidth = options.maxWidth ?? SKETCH_PARAMS.maxWidth;

  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress: options.onProgress });
    try {
      const w = getWorker();
      const request: SketchRequest = {
        type: 'sketch',
        id,
        dataUrl: sourceDataUrl,
        maxWidth,
        overlay: options.overlay ?? null,
      };
      w.postMessage(request);
    } catch (err) {
      pending.delete(id);
      reject(err instanceof Error ? err : new Error('Could not start sketch worker'));
    }
  });
}
