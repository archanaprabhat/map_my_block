import { toPng } from 'html-to-image';
import { withTimeout } from './reliability';

const DEFAULT_TIMEOUT_MS = 18000;

export type CaptureMapImageOptions = {
  pixelRatio?: number;
  timeoutMs?: number;
};

const shouldSkipNode = (node: HTMLElement) => {
  if (node.dataset.exportHidden === 'true') return true;
  if (node.classList?.contains('leaflet-control-container')) return true;
  if (node.classList?.contains('leaflet-control-attribution')) return true;
  if (node.classList?.contains('leaflet-control-zoom')) return true;
  return false;
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
      filter: (node) => !(node instanceof HTMLElement && shouldSkipNode(node)),
    }),
    timeoutMs,
    'Map capture timed out'
  );
}
