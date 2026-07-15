export const APP_RESTART_EVENT = 'map-my-block:restart';
export const APP_ONLINE_EVENT = 'map-my-block:online';

export const restartApp = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(APP_RESTART_EVENT));
  window.location.reload();
};

export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const isConnectivityError = (error: unknown) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || /network|fetch|offline|timeout|failed/i.test(error.message);
};
