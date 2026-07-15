'use client';

import { useEffect } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { restartApp } from '../lib/reliability';

const primaryColor = '#96a6b5';

export default function Error({
  error,
  unstable_retry
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('Route render failed', error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 text-center shadow-lg">
        <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-600">
          Try again first. If the screen is still stuck, restart the app. Your saved work stays on this device.
        </p>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="flex h-11 items-center justify-center gap-2 rounded-lg font-semibold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <RefreshCw size={18} />
            Try Again
          </button>
          <button
            type="button"
            onClick={restartApp}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-100 font-semibold text-gray-800"
          >
            <RotateCcw size={18} />
            Restart App
          </button>
        </div>
      </div>
    </div>
  );
}
