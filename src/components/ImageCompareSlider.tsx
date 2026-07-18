'use client';

import React, { useCallback, useId, useRef, useState } from 'react';

type ImageCompareSliderProps = {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt?: string;
  afterAlt?: string;
  initial?: number;
};

export default function ImageCompareSlider({
  beforeSrc,
  afterSrc,
  beforeAlt = 'Original map',
  afterAlt = 'Hand-drawn sketch',
  initial = 50,
}: ImageCompareSliderProps) {
  const [position, setPosition] = useState(() => Math.min(100, Math.max(0, initial)));
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const labelId = useId();

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, next)));
  }, []);

  const onPointerDown = (event: React.PointerEvent) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromClientX(event.clientX);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging.current) return;
    updateFromClientX(event.clientX);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="relative aspect-[4/3] w-full touch-none select-none overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterSrc}
          alt={afterAlt}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={beforeSrc}
            alt={beforeAlt}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        </div>

        <div
          className="absolute inset-y-0 z-10 w-0.5 bg-white shadow"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-gray-200 bg-white shadow-md">
            <span className="text-[10px] font-bold tracking-tight text-gray-700">⟷</span>
          </div>
        </div>

        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          Map
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          Sketch
        </span>
      </div>

      <label htmlFor={labelId} className="sr-only">
        Compare map and sketch
      </label>
      <input
        id={labelId}
        type="range"
        min={0}
        max={100}
        value={position}
        aria-label="Compare map and sketch"
        onChange={(e) => setPosition(Number(e.target.value))}
        className="mt-3 w-full accent-[#212121]"
      />
    </div>
  );
}
