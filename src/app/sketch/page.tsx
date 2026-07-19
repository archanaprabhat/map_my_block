'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { renderHlbMap } from '../../lib/hlb/renderHlbMap';
import { clearHlbTransfer, getHlbProject, setHlbResult } from '../../lib/hlb/hlbTransfer';
import type { CensusProject } from '../../lib/storage';

const primaryColor = '#212121';

type PageState = 'boot' | 'loading' | 'preview' | 'error';

export default function SketchPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>('boot');
  const [project, setProject] = useState<CensusProject | null>(null);
  const [mapDataUrl, setMapDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ranForKey = useRef<string | null>(null);

  const runRender = useCallback(async (snapshot: CensusProject) => {
    setState('loading');
    setError(null);
    await clearHlbTransfer();

    try {
      // Yield so loading UI paints before canvas work
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      const dataUrl = await renderHlbMap(snapshot);
      setMapDataUrl(dataUrl);
      await setHlbResult(dataUrl);
      setState('preview');
    } catch (err) {
      console.error('HLB render failed', err);
      setError(err instanceof Error ? err.message : 'HLB map failed');
      setState('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const snapshot = await getHlbProject();
      if (cancelled) return;
      if (!snapshot || snapshot.boundary.length < 3) {
        setError('No HLB data found. Go back to the map, confirm a boundary, then tap Sketch.');
        setState('error');
        return;
      }
      setProject(snapshot);
      const key = `${snapshot.boundary.length}-${snapshot.features.length}-${snapshot.features.map((f) => f.id).join(',')}`;
      if (ranForKey.current === key) return;
      ranForKey.current = key;
      void runRender(snapshot);
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [runRender]);

  const downloadMap = () => {
    if (!mapDataUrl) return;
    const link = document.createElement('a');
    link.download = `hlb-map-A4-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = mapDataUrl;
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
          <h1 className="text-base font-semibold text-[#212121]">HLB map</h1>
          <p className="text-xs text-gray-500">
            Dotted black boundary · OSM roads · place names · TagIcons
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        {(state === 'boot' || state === 'loading') && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <RefreshCw size={28} className="animate-spin" style={{ color: primaryColor }} />
            <div>
              <p className="text-base font-semibold text-[#212121]">Drawing HLB map…</p>
              <p className="mt-1 text-sm text-gray-500">
                Loading OSM roads & place names, then drawing your tags…
              </p>
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
              {project && (
                <button
                  type="button"
                  onClick={() => void runRender(project)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        {state === 'preview' && mapDataUrl && (
          <div className="flex flex-1 flex-col gap-4">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mapDataUrl}
                alt="HLB vector map"
                className="mx-auto max-h-[70dvh] w-full object-contain"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadMap}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <Download size={18} />
                Download A4
              </button>
              <button
                type="button"
                onClick={() => project && void runRender(project)}
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
