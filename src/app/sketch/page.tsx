'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { createSketchFromDataUrl } from '../../lib/sketch/sketchClient';
import { getSketchSource, getSketchOverlay, clearSketchResult } from '../../lib/sketch/sketchTransfer';

const primaryColor = '#212121';

type PageState = 'boot' | 'loading' | 'preview' | 'error';

export default function SketchPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>('boot');
  const [sourceDataUrl, setSourceDataUrl] = useState<string | null>(null);
  const [sketchDataUrl, setSketchDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const ranForSource = useRef<string | null>(null);

  const runSketch = useCallback(async (source: string) => {
    setState('loading');
    setError(null);
    setProgress(0);
    await clearSketchResult();

    try {
      const overlay = await getSketchOverlay();
      const result = await createSketchFromDataUrl(source, {
        overlay,
        onProgress: setProgress,
      });
      setSketchDataUrl(result);
      setState('preview');
      setProgress(100);
    } catch (err) {
      console.error('Sketch failed', err);
      setError(err instanceof Error ? err.message : 'Sketch failed');
      setState('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const source = await getSketchSource();
      if (cancelled) return;
      if (!source) {
        setError('No map capture found. Go back to the map and tap Sketch again.');
        setState('error');
        return;
      }
      setSourceDataUrl(source);
      if (ranForSource.current === source) return;
      ranForSource.current = source;
      void runSketch(source);
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [runSketch]);

  const downloadSketch = () => {
    if (!sketchDataUrl) return;
    const link = document.createElement('a');
    link.download = `census-sketch-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = sketchDataUrl;
    link.click();
  };

  return (
    <div className="flex min-h-dvh flex-col font-sans" style={{ backgroundColor: '#faf9f5' }}>
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => router.push('/map')}
          className="grid h-10 w-10 place-items-center rounded-lg text-gray-700 hover:bg-gray-100"
          aria-label="Back to map"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-semibold text-[#212121]">Hand-drawn sketch</h1>
          <p className="text-xs text-gray-500">Boundary crop · satellite structure · your tags/roads</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        {(state === 'boot' || state === 'loading') && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <RefreshCw size={28} className="animate-spin" style={{ color: primaryColor }} />
            <div>
              <p className="text-base font-semibold text-[#212121]">Generating hand-drawn sketch…</p>
              <p className="mt-1 text-sm text-gray-500">
                First run may take a moment while OpenCV loads.
              </p>
            </div>
            <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max(8, progress)}%`, backgroundColor: primaryColor }}
              />
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-md text-sm font-medium text-red-700">{error}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => router.push('/map')}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Back to map
              </button>
              {sourceDataUrl && (
                <button
                  type="button"
                  onClick={() => void runSketch(sourceDataUrl)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        {state === 'preview' && sketchDataUrl && (
          <div className="flex flex-1 flex-col gap-4">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sketchDataUrl}
                alt="Hand-drawn sketch of your map"
                className="mx-auto max-h-[70dvh] w-full object-contain"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadSketch}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <Download size={18} />
                Download sketch
              </button>
              <button
                type="button"
                onClick={() => sourceDataUrl && void runSketch(sourceDataUrl)}
                className="flex h-12 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800"
              >
                <RefreshCw size={16} />
                Regenerate
              </button>
              <button
                type="button"
                onClick={() => router.push('/map')}
                className="flex h-12 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800"
              >
                Back to map
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
