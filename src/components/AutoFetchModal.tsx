'use client';

import React from 'react';
import { Building2, Check, Loader2, MapPinned, Trees, X } from 'lucide-react';

const primaryColor = '#212121';

type AutoFetchModalProps = {
  open: boolean;
  onClose: () => void;
  buildingsFetched: boolean;
  buildingsLoading: boolean;
  buildingsProgress?: number;
  osmFetched: boolean;
  osmLoading: boolean;
  error: string | null;
  onFetchBuildings: () => void;
  onFetchOsm: () => void;
};

function AutoFetchModal({
  open,
  onClose,
  buildingsFetched,
  buildingsLoading,
  buildingsProgress,
  osmFetched,
  osmLoading,
  error,
  onFetchBuildings,
  onFetchOsm,
}: AutoFetchModalProps) {
  if (!open) return null;

  const busy = buildingsLoading || osmLoading;

  return (
    <div
      data-export-hidden="true"
      className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-fetch-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
        disabled={busy}
      />
      <div className="relative z-10 mx-3 mb-6 w-full max-w-md overflow-hidden rounded-2xl border border-white/40 bg-white/85 shadow-2xl backdrop-blur-xl sm:mb-0">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <div>
            <h2 id="auto-fetch-title" className="text-base font-semibold text-gray-900">
              Fetch automatically
            </h2>
            <p className="text-xs text-gray-600">Pull reference layers for your block</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="grid h-9 w-9 place-items-center rounded-lg text-gray-600 hover:bg-black/5 disabled:opacity-50"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <button
            type="button"
            onClick={onFetchBuildings}
            disabled={busy}
            className="flex w-full items-start gap-3 rounded-xl border border-white/60 bg-white/70 p-3 text-left shadow-sm backdrop-blur-md transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span
              className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {buildingsLoading ? <Loader2 size={18} className="animate-spin" /> : <Building2 size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">Get buildings from Google</span>
                {buildingsFetched && !buildingsLoading && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                    <Check size={10} /> Fetched
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-gray-600">
                Query Google Open Buildings footprints inside your boundary.
              </span>
              {buildingsLoading && (
                <span className="mt-1.5 block text-xs font-medium text-gray-700">
                  Fetching{typeof buildingsProgress === 'number' ? ` · ${buildingsProgress} found` : '…'}
                </span>
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={onFetchOsm}
            disabled={busy}
            className="flex w-full items-start gap-3 rounded-xl border border-white/60 bg-white/70 p-3 text-left shadow-sm backdrop-blur-md transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span
              className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {osmLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <span className="relative">
                  <Trees size={16} className="absolute -left-1 -top-1 opacity-80" />
                  <MapPinned size={18} />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">Get roads, forest & landmarks</span>
                {osmFetched && !osmLoading && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                    <Check size={10} /> Fetched
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-gray-600">
                Query OpenStreetMap for roads, rivers/ponds, forests, and landmarks.
              </span>
              {osmLoading && (
                <span className="mt-1.5 block text-xs font-medium text-gray-700">Querying Overpass…</span>
              )}
            </span>
          </button>

          {error && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(AutoFetchModal);
