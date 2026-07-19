/** Public Overpass endpoints — rotate on 429/5xx/timeout. */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
] as const;

const REQUEST_TIMEOUT_MS = 28000;

export async function postOverpassQuery(query: string): Promise<Response> {
  let lastError: Error | null = null;

  for (const url of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
          'User-Agent': 'MapMyBlock-Census2027/1.0',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      if (response.ok) return response;

      // Retry other mirrors on overload / gateway timeout
      if ([429, 502, 503, 504].includes(response.status)) {
        lastError = new Error(`OSM fetch failed (${response.status})`);
        continue;
      }

      throw new Error(`OSM fetch failed (${response.status})`);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error('OSM fetch timed out. Retry in a moment.');
      } else if (err instanceof Error) {
        lastError = err;
      } else {
        lastError = new Error('OSM fetch failed');
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error('OSM fetch failed');
}
