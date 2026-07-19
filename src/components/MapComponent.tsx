'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Check,
  Crosshair,
  Download,
  Edit3,
  Eye,
  EyeOff,
  ImageUp,
  Layers,
  LocateFixed,
  Lock,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Menu,
  SquarePen,
  Plus,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Search,
  Trash2,
  Unlock,
  X,
  Sparkle,
  WandSparkles,
  Building2,
  Trees
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CensusProject, Coordinate, CensusFeature, LayoutOverlay, TagType, emptyAutoFetchLayers } from '../lib/storage';
import SidebarControls, { SubTypeOption } from './SidebarControls';
import AutoFetchModal from './AutoFetchModal';
import { createTagIcon, tagColors, getLinePattern } from './TagIcons';
import PolylineDecorator from './PolylineDecorator';
import { exportGeoJSON } from '../lib/geojsonExport';
import { APP_ONLINE_EVENT, isConnectivityError, restartApp, withTimeout } from '../lib/reliability';
import { captureMapImage } from '../lib/captureMapImage';
import { setHlbProject, clearHlbTransfer } from '../lib/hlb/hlbTransfer';
import { fetchGoogleOpenBuildings } from '../lib/autoFetch/googleBuildings';
import { fetchOsmAutoLayers } from '../lib/autoFetch/osmAutoLayers';

type AppMode = 'setup' | 'field';
type ProfileTab = 'map' | 'profile';
type BaseLayer = 'street' | 'satellite';

type MapComponentProps = {
  project: CensusProject;
  mode: AppMode;
  activeTab: ProfileTab;
  onProjectChange: (project: CensusProject) => void;
  onResetProject: () => void;
  onReplaceLayout: () => void;
};

type SearchResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
};

type SegmentDragState = {
  index: number;
  start: Coordinate;
  boundary: Coordinate[];
};

const defaultCenter: [number, number] = [10.8505, 76.2711];
const mapMinZoom = 0;
const mapMaxZoom = 19;
const primaryColor = '#212121';
const tagDraftKey = 'map-my-block-tag-draft';
const searchTimeoutMs = 10000;
const exportTimeoutMs = 18000;


const tileLayers = {
  street: {
    label: 'Road',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri'
  }
};

const mapPanes = {
  boundaryMask: 'boundary-mask-pane',
  boundary: 'boundary-pane',
  autoFetch: 'auto-fetch-pane',
  features: 'feature-pane'
} as const;

const mapLayerZIndexes = {
  layoutOverlay: 550,
  boundaryMask: 560,
  boundary: 700,
  autoFetch: 720,
  features: 740
};

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const toLatLngTuple = (coordinate: Coordinate): [number, number] => [coordinate.lat, coordinate.lng];

const isSameCoordinate = (first: Coordinate, second: Coordinate) =>
  Math.abs(first.lat - second.lat) < 0.0000001 && Math.abs(first.lng - second.lng) < 0.0000001;

const isPointInsideBoundary = (point: Coordinate, boundary: Coordinate[]) => {
  if (boundary.length < 3) return true;

  let inside = false;
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const xi = boundary[i].lng;
    const yi = boundary[i].lat;
    const xj = boundary[j].lng;
    const yj = boundary[j].lat;
    const intersects = yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
};

const getDraggedSegmentBoundary = (drag: SegmentDragState, point: Coordinate) => {
  const latDelta = point.lat - drag.start.lat;
  const lngDelta = point.lng - drag.start.lng;
  const nextIndex = (drag.index + 1) % drag.boundary.length;

  return drag.boundary.map((coordinate, pointIndex) => {
    if (pointIndex !== drag.index && pointIndex !== nextIndex) return coordinate;
    return {
      lat: coordinate.lat + latDelta,
      lng: coordinate.lng + lngDelta
    };
  });
};

const createDefaultOverlay = (center: Coordinate, aspectRatio: number): LayoutOverlay => ({
  center,
  widthMeters: 350,
  heightMeters: 350 / Math.max(0.1, aspectRatio),
  aspectRatio: Math.max(0.1, aspectRatio),
  rotation: 0,
  opacity: 0.55,
  isLocked: false,
  isVisible: true
});

const ControlButton = ({
  title,
  onClick,
  children,
  active = false,
  disabled = false
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    disabled={disabled}
    className={`grid h-11 w-11 place-items-center rounded-lg border text-gray-800 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'text-white' : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    style={active ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
  >
    {children}
  </button>
);

function MapActions({
  baseLayer,
  onBaseLayerChange,
  onBoundary,
  hasBoundary,
  onLocate,
  onZoomIn,
  onZoomOut
}: {
  baseLayer: BaseLayer;
  onBaseLayerChange: () => void;
  onBoundary: () => void;
  hasBoundary: boolean;
  onLocate: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div data-export-hidden="true" className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
      <ControlButton title="Zoom in" onClick={onZoomIn}>
        <Plus size={20} />
      </ControlButton>
      <ControlButton title="Zoom out" onClick={onZoomOut}>
        <Minus size={20} />
      </ControlButton>
      <ControlButton title="Locate me" onClick={onLocate}>
        <LocateFixed size={20} />
      </ControlButton>
      <ControlButton title="My Boundary" onClick={onBoundary} disabled={!hasBoundary}>
        <MapPin size={20} />
      </ControlButton>
      <ControlButton title={`Switch to ${baseLayer === 'street' ? 'satellite' : 'road'} map`} onClick={onBaseLayerChange}>
        <Layers size={20} />
      </ControlButton>
    </div>
  );
}

function SearchBox({ onLocationSelect }: { onLocationSelect: (coordinate: Coordinate) => void }) {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeResult, setActiveResult] = useState<SearchResult | null>(null);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const skipNextSearch = useRef(false);

  const performSearch = useCallback(
    async (nextQuery: string, signal?: AbortSignal) => {
      const trimmedQuery = nextQuery.trim();
      if (trimmedQuery.length < 3) {
        setSearchStatus('idle');
        setSearchError(null);
        setResults([]);
        return;
      }

      if (!navigator.onLine) {
        setSearchStatus('error');
        setSearchError('Search needs internet. Retry when you are online.');
        setResults([]);
        return;
      }

      setSearchStatus('loading');
      setSearchError(null);

      try {
        const response = await withTimeout(
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmedQuery)}&limit=5`, {
            signal
          }),
          searchTimeoutMs,
          'Search request timed out'
        );

        if (!response.ok) throw new Error(`Search failed with status ${response.status}`);
        const data = (await response.json()) as SearchResult[];
        setResults(data);
        setSearchStatus('idle');
        if (data.length === 0) setSearchError('No matching place found.');
      } catch (err) {
        if (signal?.aborted) return;
        console.error('Search failed', err);
        setResults([]);
        setSearchStatus('error');
        setSearchError(isConnectivityError(err) ? 'Could not reach search. Check connection and retry.' : 'Search failed. Please retry.');
      }
    },
    []
  );

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    if (query.trim().length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      performSearch(query, controller.signal);
    }, 450);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [performSearch, query]);

  useEffect(() => {
    const retryCurrentSearch = () => {
      if (query.trim().length >= 3 && searchStatus === 'error') {
        performSearch(query);
      }
    };

    window.addEventListener(APP_ONLINE_EVENT, retryCurrentSearch);
    return () => {
      window.removeEventListener(APP_ONLINE_EVENT, retryCurrentSearch);
    };
  }, [performSearch, query, searchStatus]);

  const selectResult = (result: SearchResult) => {
    const coordinate = { lat: Number(result.lat), lng: Number(result.lon) };
    skipNextSearch.current = true;
    onLocationSelect(coordinate);
    map.flyTo(toLatLngTuple(coordinate), 17);
    setQuery(result.display_name);
    setActiveResult(result);
    setResults([]);
  };

  const clearSearch = () => {
    skipNextSearch.current = true;
    setQuery('');
    setResults([]);
    setActiveResult(null);
    setSearchStatus('idle');
    setSearchError(null);
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const exactActiveQuery = activeResult && query.trim() === activeResult.display_name;
    if (exactActiveQuery) {
      selectResult(activeResult);
      return;
    }

    if (results.length > 0) {
      selectResult(results[0]);
    }
  };

  return (
    <div data-export-hidden="true" className="absolute left-3 right-[4.25rem] top-3 z-[1000]">
      <form className="relative" onSubmit={submitSearch}>
        <Search size={18} className="pointer-events-none absolute left-3 top-3.5 text-gray-400" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveResult(null);
            setSearchError(null);
            if (event.target.value.trim().length < 3) {
              setResults([]);
              setSearchStatus('idle');
            }
          }}
          className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-600"
          placeholder="Search village, road, landmark"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Clear search"
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}
        {results.length > 0 && (
          <div className="absolute mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {results.map((result) => (
              <button
                key={result.place_id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectResult(result)}
                className="block w-full border-b border-gray-100 px-3 py-3 text-left text-xs text-gray-700 last:border-b-0 hover:bg-blue-50"
              >
                {result.display_name}
              </button>
            ))}
          </div>
        )}
        {searchStatus === 'loading' && (
          <div className="absolute mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-xs font-medium text-gray-600 shadow-lg">
            Searching...
          </div>
        )}
        {searchError && results.length === 0 && (
          <div className="absolute mt-2 w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 shadow-lg">
            <p className="font-semibold">{searchError}</p>
            {searchStatus === 'error' && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => performSearch(query)}
                className="mt-2 flex h-8 w-full items-center justify-center gap-1 rounded-md bg-amber-900 font-semibold text-white"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

function MapGestureMode({ locked }: { locked: boolean }) {
  const map = useMap();

  useEffect(() => {
    const handlers = [map.dragging, map.touchZoom, map.doubleClickZoom, map.scrollWheelZoom, map.boxZoom, map.keyboard];

    handlers.forEach((handler) => {
      if (locked) {
        handler.disable();
      } else {
        handler.enable();
      }
    });

    return () => {
      handlers.forEach((handler) => handler.enable());
    };
  }, [locked, map]);

  return null;
}

function LocateOnMount({ onLocation }: { onLocation: (coordinate: Coordinate) => void }) {
  const map = useMap();
  const hasRequested = useRef(false);

  useEffect(() => {
    if (hasRequested.current || typeof navigator === 'undefined' || !navigator.geolocation) return;
    hasRequested.current = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinate = { lat: position.coords.latitude, lng: position.coords.longitude };
        onLocation(coordinate);
        map.flyTo(toLatLngTuple(coordinate), 18);
      },
      (error) => {
        console.warn('Location permission was not granted', error);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, [map, onLocation]);

  return null;
}

function ClickToPlot({
  enabled,
  onAddPoint,
  onMapInteraction
}: {
  enabled: boolean;
  onAddPoint: (point: Coordinate) => void;
  onMapInteraction: () => void;
}) {
  const map = useMapEvents({
    mousedown() {
      onMapInteraction();
    },
    click(event) {
      onMapInteraction();
      if (enabled) onAddPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
    }
  });

  useEffect(() => {
    map.on('touchstart', onMapInteraction);
    return () => {
      map.off('touchstart', onMapInteraction);
    };
  }, [map, onMapInteraction]);

  return null;
}

function MapBridge({
  onReady,
  onCenterChange
}: {
  onReady: (map: L.Map) => void;
  onCenterChange: (center: Coordinate) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
    const updateCenter = () => {
      const center = map.getCenter();
      onCenterChange({ lat: center.lat, lng: center.lng });
    };

    updateCenter();
    map.on('moveend', updateCenter);
    return () => {
      map.off('moveend', updateCenter);
    };
  }, [map, onCenterChange, onReady]);

  return null;
}

function MapLayerPanes() {
  const map = useMap();

  useEffect(() => {
    const panes = [
      [mapPanes.boundaryMask, mapLayerZIndexes.boundaryMask],
      [mapPanes.boundary, mapLayerZIndexes.boundary],
      [mapPanes.autoFetch, mapLayerZIndexes.autoFetch],
      [mapPanes.features, mapLayerZIndexes.features]
    ] as const;

    panes.forEach(([paneName, zIndex]) => {
      const pane = map.getPane(paneName) ?? map.createPane(paneName);
      pane.style.zIndex = String(zIndex);
    });
  }, [map]);

  return null;
}

function FittedBoundary({ boundary }: { boundary: Coordinate[] }) {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (hasFit.current || boundary.length < 3) return;
    hasFit.current = true;
    map.fitBounds(L.latLngBounds(boundary.map(toLatLngTuple)), { padding: [28, 28] });
  }, [boundary, map]);

  return null;
}

function LayoutImageOverlay({
  image,
  overlay,
  selected,
  plotting,
  onSelect,
  onGestureStart,
  onGestureEnd,
  onPreview,
  onCommit
}: {
  image: string;
  overlay: LayoutOverlay;
  selected: boolean;
  plotting: boolean;
  onSelect: () => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onPreview: (overlay: LayoutOverlay) => void;
  onCommit: () => void;
}) {
  const map = useMap();
  const [style, setStyle] = useState<React.CSSProperties>({});
  const transformStart = useRef<{
    mode: 'move' | 'resize' | 'rotate';
    pointer: L.Point;
    center: Coordinate;
    widthMeters?: number;
    rotation?: number;
    startAngle?: number;
    resizeDirection?: { x: -1 | 0 | 1; y: -1 | 0 | 1 };
    pixelWidth?: number;
  } | null>(null);

  const updatePosition = useCallback(() => {
    const centerLatLng = L.latLng(overlay.center.lat, overlay.center.lng);
    const center = map.latLngToContainerPoint(centerLatLng);

    // Web Mercator meters-per-pixel formula
    const earthCircumference = 40075016.686;
    const latitudeRadians = (overlay.center.lat * Math.PI) / 180;
    const mapZoom = map.getZoom();

    // At zoom 0, the map is 256 pixels wide.
    const metersPerPixel = (earthCircumference * Math.cos(latitudeRadians)) / Math.pow(2, mapZoom + 8);
    const safeMetersPerPixel = Math.max(0.000001, metersPerPixel);

    const heightMeters = overlay.heightMeters || overlay.widthMeters / Math.max(0.1, overlay.aspectRatio);
    const width = overlay.widthMeters / safeMetersPerPixel;
    const height = heightMeters / safeMetersPerPixel;

    setStyle({
      left: center.x,
      top: center.y,
      width,
      height,
      zIndex: mapLayerZIndexes.layoutOverlay,
      aspectRatio: overlay.aspectRatio,
      opacity: overlay.opacity,
      transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
      pointerEvents: plotting || overlay.isLocked ? 'none' : 'auto'
    });
  }, [
    map,
    overlay.aspectRatio,
    overlay.center.lat,
    overlay.center.lng,
    overlay.heightMeters,
    overlay.isLocked,
    overlay.opacity,
    overlay.rotation,
    overlay.widthMeters,
    plotting
  ]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updatePosition);
    map.on('move zoom resize', updatePosition);
    return () => {
      window.cancelAnimationFrame(frame);
      map.off('move zoom resize', updatePosition);
    };
  }, [map, updatePosition]);

  const startMove = (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    if (overlay.isLocked) return;
    onGestureStart();
    event.currentTarget.setPointerCapture(event.pointerId);
    transformStart.current = {
      mode: 'move',
      pointer: L.point(event.clientX, event.clientY),
      center: overlay.center
    };
  };

  const startResize = (direction: { x: -1 | 0 | 1; y: -1 | 0 | 1 }) => (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    if (overlay.isLocked) return;
    onGestureStart();
    event.currentTarget.setPointerCapture(event.pointerId);
    transformStart.current = {
      mode: 'resize',
      pointer: L.point(event.clientX, event.clientY),
      center: overlay.center,
      widthMeters: overlay.widthMeters,
      rotation: overlay.rotation,
      resizeDirection: direction,
      pixelWidth: Number(style.width) || 1
    };
  };

  const startRotate = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    if (overlay.isLocked) return;
    onGestureStart();
    event.currentTarget.setPointerCapture(event.pointerId);
    const center = map.latLngToContainerPoint([overlay.center.lat, overlay.center.lng]);
    const pointer = L.point(event.clientX, event.clientY);
    transformStart.current = {
      mode: 'rotate',
      pointer,
      center: overlay.center,
      widthMeters: overlay.widthMeters,
      rotation: overlay.rotation,
      startAngle: Math.atan2(pointer.y - center.y, pointer.x - center.x)
    };
  };

  const transform = (event: React.PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    const start = transformStart.current;
    if (!start || overlay.isLocked) return;

    const pointer = L.point(event.clientX, event.clientY);
    if (start.mode === 'move') {
      const startPoint = map.latLngToContainerPoint([start.center.lat, start.center.lng]);
      const nextPoint = startPoint.add(pointer.subtract(start.pointer));
      const nextCenter = map.containerPointToLatLng(nextPoint);
      onPreview({ ...overlay, center: { lat: nextCenter.lat, lng: nextCenter.lng } });
      return;
    }

    if (start.mode === 'resize') {
      const direction = start.resizeDirection ?? { x: 1, y: 0 };
      const radians = ((start.rotation ?? overlay.rotation) * Math.PI) / 180;
      const dx = pointer.x - start.pointer.x;
      const dy = pointer.y - start.pointer.y;
      const localX = dx * Math.cos(radians) + dy * Math.sin(radians);
      const localY = -dx * Math.sin(radians) + dy * Math.cos(radians);
      const directionalDelta = direction.x * localX + direction.y * localY * overlay.aspectRatio;
      const startWidthMeters = start.widthMeters ?? overlay.widthMeters;
      const metersPerPixel = startWidthMeters / Math.max(1, start.pixelWidth ?? 1);
      const widthMeters = Math.max(60, Math.min(2200, startWidthMeters + directionalDelta * metersPerPixel));
      onPreview({ ...overlay, widthMeters, heightMeters: widthMeters / Math.max(0.1, overlay.aspectRatio) });
      return;
    }

    const center = map.latLngToContainerPoint([overlay.center.lat, overlay.center.lng]);
    const angle = Math.atan2(pointer.y - center.y, pointer.x - center.x);
    const delta = ((angle - (start.startAngle ?? angle)) * 180) / Math.PI;
    onPreview({ ...overlay, rotation: (start.rotation ?? overlay.rotation) + delta });
  };

  const endTransform = () => {
    onGestureEnd();
    onCommit();
    transformStart.current = null;
  };

  if (!overlay.isVisible) return null;

  return (
    <div
      onPointerDown={startMove}
      onPointerMove={transform}
      onPointerUp={endTransform}
      onPointerCancel={endTransform}
      onLostPointerCapture={endTransform}
      className={`absolute touch-none select-none ${selected ? 'outline outline-3' : 'outline outline-1 outline-white/70'
        } ${overlay.isLocked ? 'cursor-default' : 'cursor-move'}`}
      style={{ ...style, outlineColor: selected ? primaryColor : undefined }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" className="h-full w-full object-contain" draggable={false} />
      {selected && !overlay.isLocked && !plotting && (
        <>
          {[
            ['nw', -1, -1, 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize'],
            ['n', 0, -1, 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize'],
            ['ne', 1, -1, 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize'],
            ['e', 1, 0, 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize'],
            ['se', 1, 1, 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'],
            ['s', 0, 1, 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize'],
            ['sw', -1, 1, 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize'],
            ['w', -1, 0, 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize']
          ].map(([key, x, y, className]) => (
            <button
              key={key}
              type="button"
              title="Resize layout map"
              aria-label="Resize layout map"
              onPointerDown={startResize({ x: x as -1 | 0 | 1, y: y as -1 | 0 | 1 })}
              onPointerMove={transform}
              onPointerUp={endTransform}
              onPointerCancel={endTransform}
              onLostPointerCapture={endTransform}
              className={`absolute h-5 w-5 rounded-full border-2 border-white shadow ${className}`}
              style={{ backgroundColor: primaryColor }}
            />
          ))}
          <button
            type="button"
            title="Rotate layout map"
            aria-label="Rotate layout map"
            onPointerDown={startRotate}
            onPointerMove={transform}
            onPointerUp={endTransform}
            onPointerCancel={endTransform}
            onLostPointerCapture={endTransform}
            className="absolute left-1/2 top-0 grid h-9 w-9 -translate-x-1/2 -translate-y-14 place-items-center rounded-full border-2 border-white text-white shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <RotateCw size={18} />
          </button>
        </>
      )}
    </div>
  );
}

function BoundaryMask({ boundary }: { boundary: Coordinate[] }) {
  if (boundary.length < 3) return null;

  const world: [number, number][] = [
    [85, -180],
    [85, 180],
    [-85, 180],
    [-85, -180]
  ];

  return (
    <Polygon
      pane={mapPanes.boundaryMask}
      positions={[world, boundary.map(toLatLngTuple)]}
      pathOptions={{ color: '#111827', fillColor: '#111827', fillOpacity: 0.52, stroke: false, fillRule: 'evenodd' }}
      interactive={false}
    />
  );
}

// Removed TagEditor
function MapInteractionHandler({
  interactionState,
  onPointPlaced,
  onPolylineClick,
  onPolylineFinish
}: {
  interactionState: 'idle' | 'placement_point' | 'drawing_polyline';
  onPointPlaced: (coord: Coordinate) => void;
  onPolylineClick: (coord: Coordinate) => void;
  onPolylineFinish: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (interactionState === 'idle') {
      map.doubleClickZoom.enable();
      return;
    }

    if (interactionState === 'drawing_polyline') {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }

    const handleClick = (e: L.LeafletMouseEvent) => {
      const coord = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (interactionState === 'placement_point') {
        onPointPlaced(coord);
      } else if (interactionState === 'drawing_polyline') {
        onPolylineClick(coord);
      }
    };

    const handleDblClick = (e: L.LeafletMouseEvent) => {
      if (interactionState === 'drawing_polyline') {
        L.DomEvent.stopPropagation(e);
        onPolylineFinish();
      }
    };

    map.on('click', handleClick);
    map.on('dblclick', handleDblClick);

    return () => {
      map.off('click', handleClick);
      map.off('dblclick', handleDblClick);
    };
  }, [map, interactionState, onPointPlaced, onPolylineClick, onPolylineFinish]);

  return null;
}

export default function MapComponent({ project, mode, activeTab, onProjectChange, onResetProject, onReplaceLayout }: MapComponentProps) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [language, setLanguage] = useState<'en' | 'ml'>('en');
  const [interactionState, setInteractionState] = useState<'idle' | 'placement_point' | 'drawing_polyline'>('idle');
  const [selectedType, setSelectedType] = useState<TagType | null>(null);
  const [selectedSubType, setSelectedSubType] = useState<SubTypeOption | null>(null);
  const [currentDrawingCoords, setCurrentDrawingCoords] = useState<Coordinate[]>([]);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('street');
  const [isPlotting, setIsPlotting] = useState(false);
  const [selectedOverlay, setSelectedOverlay] = useState(false);
  const [interactionMode, setInteractionMode] = useState<'map' | 'image'>('map');
  const [isSetupPanelOpen, setIsSetupPanelOpen] = useState(false);
  const [isOverlayGestureActive, setIsOverlayGestureActive] = useState(false);
  const [isBoundaryClosed, setIsBoundaryClosed] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinate>(
    project.initialLocation
      ? { lat: project.initialLocation.lat, lng: project.initialLocation.lng }
      : { lat: defaultCenter[0], lng: defaultCenter[1] }
  );
  const [overlayFocus, setOverlayFocus] = useState<Coordinate>(
    project.initialLocation
      ? { lat: project.initialLocation.lat, lng: project.initialLocation.lng }
      : { lat: defaultCenter[0], lng: defaultCenter[1] }
  );
  const [draftBoundary, setDraftBoundary] = useState<Coordinate[] | null>(null);
  const [draftOverlay, setDraftOverlay] = useState<LayoutOverlay | null>(null);
  const [isBoundarySegmentDragging, setIsBoundarySegmentDragging] = useState(false);
  const [editingTag, setEditingTag] = useState<CensusFeature | null>(null);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSketching, setIsSketching] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isAutoFetchOpen, setIsAutoFetchOpen] = useState(false);
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [buildingsProgress, setBuildingsProgress] = useState<number | undefined>(undefined);
  const [osmLoading, setOsmLoading] = useState(false);
  const [autoFetchError, setAutoFetchError] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const segmentDragRef = useRef<SegmentDragState | null>(null);
  const latestProjectRef = useRef(project);

  const updateProject = (changes: Partial<CensusProject>) => onProjectChange({ ...project, ...changes });
  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);
  const handleCenterChange = useCallback((center: Coordinate) => {
    setMapCenter((currentCenter) => (isSameCoordinate(currentCenter, center) ? currentCenter : center));
  }, []);
  const overlay = draftOverlay ?? project.layoutOverlay;
  const hasBoundary = project.boundary.length >= 3;
  const isBoundaryFocusActive = project.isBoundaryConfirmed;
  const initialCenter = project.boundary.length > 0
    ? project.boundary[0]
    : (project.initialLocation ? { lat: project.initialLocation.lat, lng: project.initialLocation.lng } : mapCenter);
  const visibleBoundary = draftBoundary ?? project.boundary;
  const shouldCloseBoundaryPath = isBoundaryClosed || project.isBoundaryConfirmed;
  const boundaryLine = shouldCloseBoundaryPath && visibleBoundary.length > 0 ? [...visibleBoundary, visibleBoundary[0]] : visibleBoundary;

  const fitBoundary = useMemo(() => (project.isBoundaryConfirmed ? project.boundary : []), [project.isBoundaryConfirmed, project.boundary]);

  const focusOverlayAt = (coordinate: Coordinate) => {
    setOverlayFocus(coordinate);
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      setLocationError('Location is not supported on this device.');
      return;
    }
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinate = { lat: position.coords.latitude, lng: position.coords.longitude };
        setLocationError(null);
        setCurrentLocation(coordinate);
        focusOverlayAt(coordinate);
        mapRef.current?.flyTo(toLatLngTuple(coordinate), 18);
      },
      () => setLocationError('Unable to get location. Please allow location access and retry.'),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const goToBoundary = () => {
    if (project.boundary.length === 0 || !mapRef.current) return;

    if (project.boundary.length === 1) {
      mapRef.current.flyTo(toLatLngTuple(project.boundary[0]), Math.max(mapRef.current.getZoom(), 17));
      return;
    }

    mapRef.current.fitBounds(L.latLngBounds(project.boundary.map(toLatLngTuple)), {
      animate: true,
      padding: [36, 36]
    });
  };

  const addBoundaryPoint = (point: Coordinate) => {
    if (isBoundaryClosed) return;
    setDraftBoundary(null);
    updateProject({ boundary: [...project.boundary, point], isBoundaryConfirmed: false });
    setIsBoundaryClosed(false);
  };

  const moveBoundaryPoint = (index: number, point: Coordinate) => {
    const nextBoundary = project.boundary.map((coordinate, pointIndex) => (pointIndex === index ? point : coordinate));
    setDraftBoundary(null);
    updateProject({ boundary: nextBoundary, isBoundaryConfirmed: false });
  };

  const previewBoundaryPoint = (index: number, point: Coordinate) => {
    setDraftBoundary(project.boundary.map((coordinate, pointIndex) => (pointIndex === index ? point : coordinate)));
  };

  const deleteBoundaryPoint = (index: number) => {
    setDraftBoundary(null);
    updateProject({ boundary: project.boundary.filter((_, pointIndex) => pointIndex !== index), isBoundaryConfirmed: false });
    setIsBoundaryClosed(false);
  };

  const undoBoundaryPoint = () => {
    setDraftBoundary(null);
    updateProject({ boundary: project.boundary.slice(0, -1), isBoundaryConfirmed: false });
    setIsBoundaryClosed(false);
  };

  const clearBoundary = () => {
    setDraftBoundary(null);
    updateProject({ boundary: [], isBoundaryConfirmed: false });
    setIsBoundaryClosed(false);
  };

  const startBoundarySegmentDrag = (index: number, event: L.LeafletMouseEvent) => {
    if (!shouldCloseBoundaryPath || project.isBoundaryConfirmed || project.boundary.length < 3) return;

    event.originalEvent?.preventDefault();
    event.originalEvent?.stopPropagation();
    setInteractionMode('map');
    segmentDragRef.current = {
      index,
      start: { lat: event.latlng.lat, lng: event.latlng.lng },
      boundary: project.boundary
    };
    setDraftBoundary(project.boundary);
    setIsBoundarySegmentDragging(true);
    mapRef.current?.dragging.disable();
  };

  useEffect(() => {
    latestProjectRef.current = project;
  }, [project]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isBoundarySegmentDragging || !map) return;

    const moveSegment = (event: L.LeafletMouseEvent) => {
      const drag = segmentDragRef.current;
      if (!drag) return;
      setDraftBoundary(getDraggedSegmentBoundary(drag, { lat: event.latlng.lat, lng: event.latlng.lng }));
    };

    const endSegmentDrag = (event: L.LeafletMouseEvent) => {
      const drag = segmentDragRef.current;
      if (drag) {
        const nextBoundary = getDraggedSegmentBoundary(drag, { lat: event.latlng.lat, lng: event.latlng.lng });
        onProjectChange({
          ...latestProjectRef.current,
          boundary: nextBoundary,
          isBoundaryConfirmed: false
        });
      }

      segmentDragRef.current = null;
      setDraftBoundary(null);
      setIsBoundarySegmentDragging(false);
      map.dragging.enable();
    };

    map.on('mousemove', moveSegment);
    map.on('mouseup', endSegmentDrag);
    map.on('mouseout', endSegmentDrag);

    return () => {
      map.off('mousemove', moveSegment);
      map.off('mouseup', endSegmentDrag);
      map.off('mouseout', endSegmentDrag);
      if (!segmentDragRef.current) map.dragging.enable();
    };
  }, [isBoundarySegmentDragging, onProjectChange]);

  const closeBoundaryLoop = () => {
    if (!hasBoundary) {
      alert('Add at least 3 boundary points before closing the boundary.');
      return;
    }

    setIsBoundaryClosed(true);
    setIsPlotting(false);
  };

  const confirmBoundary = () => {
    if (!hasBoundary) {
      alert('Add at least 3 boundary points before confirming.');
      return;
    }
    if (!isBoundaryClosed) {
      alert('Close the boundary loop before confirming.');
      return;
    }

    setIsPlotting(false);
    updateProject({
      isBoundaryConfirmed: true,
      layoutOverlay: project.layoutOverlay ? { ...project.layoutOverlay, isVisible: false } : null
    });
  };

  const toggleLayoutMap = () => {
    if (project.layoutOverlay) {
      const isVisible = !project.layoutOverlay.isVisible;
      updateProject({ layoutOverlay: { ...project.layoutOverlay, isVisible } });
      setSelectedOverlay(isVisible);
      if (isVisible) setInteractionMode('image');
      return;
    }

    const center = mapRef.current?.getCenter() || initialCenter;
    const centerForOverlay = { lat: center.lat, lng: center.lng };
    updateProject({ layoutOverlay: createDefaultOverlay(centerForOverlay, project.layoutImageAspectRatio) });
    setSelectedOverlay(true);
    setInteractionMode('image');
    setIsSetupPanelOpen(true);
  };

  const saveTag = (data: { label: string; type: TagType; otherLabel?: string }) => {
    if (editingTag) {
      updateProject({
        features: project.features.map((tag) => (tag.id === editingTag.id ? { ...tag, type: data.type, properties: { ...tag.properties, ...data } } : tag))
      });
      setEditingTag(null);
      return;
    }

    const coordinate = currentLocation ?? mapCenter;
    if (!isPointInsideBoundary(coordinate, project.boundary)) {
      const shouldContinue = window.confirm('This point is outside your confirmed boundary. Add it anyway?');
      if (!shouldContinue) return;
    }

    const nextTag: CensusFeature = {
      id: `${Date.now()}`,
      type: data.type,
      subType: data.type,
      geometry: { type: 'Point', coordinates: coordinate },
      properties: {
        label: data.label,
        otherLabel: data.otherLabel,
        timestamp: Date.now()
      }
    };

    updateProject({ features: [...project.features, nextTag] });
    setIsAddingTag(false);
  };

  const deleteTag = (id: string) => {
    updateProject({ features: project.features.filter((tag) => tag.id !== id) });
    setEditingTag(null);
  };

  const finishPolylineDrawing = () => {
    if (interactionState !== 'drawing_polyline') return;

    if (!selectedType || !selectedSubType || currentDrawingCoords.length < 2) {
      setInteractionState('idle');
      setSelectedType(null);
      setSelectedSubType(null);
      setCurrentDrawingCoords([]);
      return;
    }
    const newFeature: CensusFeature = {
      id: `${Date.now()}`,
      type: selectedType,
      subType: selectedSubType.id,
      geometry: { type: 'LineString', coordinates: currentDrawingCoords },
      properties: { label: '', timestamp: Date.now() }
    };
    updateProject({ features: [...project.features, newFeature] });
    setInteractionState('idle');
    setSelectedType(null);
    setSelectedSubType(null);
    setCurrentDrawingCoords([]);
  };

  const exportMap = async () => {
    if (!exportRef.current || isExporting) return;

    try {
      setIsExporting(true);
      setExportError(null);
      const dataUrl = await captureMapImage(exportRef.current, { timeoutMs: exportTimeoutMs });
      const link = document.createElement('a');
      link.download = `census-map-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Map export failed', err);
      setExportError('Export failed. Retry, or switch to road map if satellite tiles are not available offline.');
    } finally {
      setIsExporting(false);
    }
  };

  const prepareHlbSnapshot = async () => {
    if (project.boundary.length < 3) {
      throw new Error('Confirm a boundary before generating an HLB map.');
    }
    await clearHlbTransfer();
    await setHlbProject(project);
  };

  /** Prefetch so right-click → Open in new tab / middle-click has data ready. */
  const prefetchHlbSnapshot = () => {
    if (project.boundary.length < 3 || isExporting || isSketching) return;
    void prepareHlbSnapshot().catch(() => {
      /* ignore prefetch errors */
    });
  };

  const goToSketch = async (event?: React.MouseEvent) => {
    if (isSketching || isExporting) return;
    if (project.boundary.length < 3) {
      setExportError('Confirm a boundary before generating an HLB map.');
      return;
    }

    // Ctrl/Cmd/Shift/Alt or middle-click → native <a> new-tab navigation
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1)) {
      return;
    }

    try {
      setIsSketching(true);
      setExportError(null);
      await prepareHlbSnapshot();
      router.push('/sketch');
    } catch (err) {
      console.error('HLB prepare failed', err);
      setExportError('Could not prepare HLB map. Retry.');
    } finally {
      setIsSketching(false);
    }
  };

  const autoLayers = project.autoFetchLayers ?? emptyAutoFetchLayers();

  const handleFetchBuildings = async () => {
    if (project.boundary.length < 3 || !project.isBoundaryConfirmed) {
      setAutoFetchError('Confirm your boundary before fetching buildings.');
      return;
    }
    setBuildingsLoading(true);
    setBuildingsProgress(0);
    setAutoFetchError(null);
    try {
      const footprints = await fetchGoogleOpenBuildings(project.boundary, setBuildingsProgress);
      updateProject({
        autoFetchLayers: {
          ...autoLayers,
          buildings: {
            fetched: true,
            visible: true,
            fetchedAt: Date.now(),
            footprints,
          },
        },
      });
    } catch (err) {
      console.error('Google Open Buildings fetch failed', err);
      setAutoFetchError(
        isConnectivityError(err)
          ? 'Could not reach Google Open Buildings. Check your connection and retry.'
          : err instanceof Error
            ? err.message
            : 'Building fetch failed. Retry.'
      );
    } finally {
      setBuildingsLoading(false);
      setBuildingsProgress(undefined);
    }
  };

  const handleFetchOsm = async () => {
    if (project.boundary.length < 3 || !project.isBoundaryConfirmed) {
      setAutoFetchError('Confirm your boundary before fetching OSM layers.');
      return;
    }
    setOsmLoading(true);
    setAutoFetchError(null);
    try {
      const result = await fetchOsmAutoLayers(project.boundary);
      updateProject({
        autoFetchLayers: {
          ...autoLayers,
          osmContext: {
            fetched: true,
            visible: true,
            fetchedAt: Date.now(),
            roads: result.roads,
            forests: result.forests,
            waters: result.waters,
            landmarks: result.landmarks,
          },
        },
      });
    } catch (err) {
      console.error('OSM auto-fetch failed', err);
      setAutoFetchError(
        isConnectivityError(err)
          ? 'Could not reach OpenStreetMap. Check your connection and retry.'
          : err instanceof Error
            ? err.message
            : 'OSM fetch failed. Retry.'
      );
    } finally {
      setOsmLoading(false);
    }
  };

  const toggleBuildingsVisible = () => {
    if (!autoLayers.buildings.fetched) return;
    updateProject({
      autoFetchLayers: {
        ...autoLayers,
        buildings: { ...autoLayers.buildings, visible: !autoLayers.buildings.visible },
      },
    });
  };

  const toggleOsmVisible = () => {
    if (!autoLayers.osmContext.fetched) return;
    updateProject({
      autoFetchLayers: {
        ...autoLayers,
        osmContext: { ...autoLayers.osmContext, visible: !autoLayers.osmContext.visible },
      },
    });
  };

  if (activeTab === 'profile') {
    return (
      <div className="flex min-h-dvh flex-col bg-gray-50 px-4 pb-24 pt-6">
        <div className="mx-auto w-full max-w-md rounded-xl bg-white p-4 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-gray-50 p-3">
              <span className="block text-gray-500">Boundary points</span>
              <strong className="text-lg text-gray-900">{project.boundary.length}</strong>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <span className="block text-gray-500">Tags added</span>
              <strong className="text-lg text-gray-900">{project.features.length}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={onReplaceLayout}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg font-medium text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <ImageUp size={18} />
            Change layout map
          </button>
          <button
            type="button"
            onClick={onResetProject}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 font-medium text-white"
          >
            <Trash2 size={18} />
            Delete map and start over
          </button>
          <button
            type="button"
            onClick={restartApp}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-100 font-medium text-gray-800"
          >
            <RotateCcw size={18} />
            Restart App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-gray-50 md:flex-row">
      {(mode === 'field' || mode === 'setup') && (
        <SidebarControls
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          features={project.features}
          onSelectSubType={(type, subType) => {
            setSelectedType(type);
            setSelectedSubType(subType);
            setInteractionState(subType.geometry === 'Point' ? 'placement_point' : 'drawing_polyline');
            setCurrentDrawingCoords([]);
          }}
          onFlyTo={(feature) => {
            if (feature.geometry.type === 'Point') {
              mapRef.current?.flyTo([feature.geometry.coordinates.lat, feature.geometry.coordinates.lng], 18);
            } else if (feature.geometry.type === 'LineString' && (feature.geometry.coordinates as Coordinate[]).length > 0) {
              const firstCoord = (feature.geometry.coordinates as Coordinate[])[0];
              mapRef.current?.flyTo([firstCoord.lat, firstCoord.lng], 18);
            }
          }}
          onDeleteFeature={deleteTag}
          onEditFeature={setEditingTag}
          onUpdateFeature={(id, label) => {
            updateProject({
              features: project.features.map(f => f.id === id ? { ...f, properties: { ...f.properties, label } } : f)
            });
          }}
          language={language}
          onToggleLanguage={() => setLanguage(l => l === 'en' ? 'ml' : 'en')}
        />
      )}

      <div ref={exportRef} className="relative flex-1 h-dvh overflow-hidden bg-white">
        {interactionState !== 'idle' && selectedSubType && (
          <div data-export-hidden="true" className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] flex items-center gap-3 px-4 py-2 rounded-full bg-white/90 backdrop-blur-md shadow-lg border border-gray-200 text-sm font-semibold text-indigo-900 animate-in fade-in slide-in-from-top-4">
            <span className="pointer-events-none">
              {interactionState === 'placement_point'
                ? `Tap map to place ${language === 'en' ? selectedSubType.labelEn : selectedSubType.labelMl}`
                : `Tap to draw ${language === 'en' ? selectedSubType.labelEn : selectedSubType.labelMl}, double-tap to finish`}
            </span>
            <button
              onClick={finishPolylineDrawing}
              className="ml-2 rounded-full bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700 shadow-sm"
            >
              Done
            </button>
          </div>
        )}
        <MapContainer center={initialCenter} zoom={16} minZoom={mapMinZoom} maxZoom={mapMaxZoom} zoomControl={false} className="h-full w-full">
          <MapBridge onReady={handleMapReady} onCenterChange={handleCenterChange} />
          <MapLayerPanes />
          <MapGestureMode locked={mode === 'setup' && (isOverlayGestureActive || isBoundarySegmentDragging)} />
          {!project.initialLocation && (
            <LocateOnMount
              onLocation={(coord) => {
                handleCenterChange(coord);
                setOverlayFocus(coord);
              }}
            />
          )}
          <FittedBoundary boundary={fitBoundary} />
          <TileLayer
            attribution={tileLayers[baseLayer].attribution}
            url={tileLayers[baseLayer].url}
            minZoom={mapMinZoom}
            maxZoom={mapMaxZoom}
            maxNativeZoom={19}
          />
          <SearchBox onLocationSelect={focusOverlayAt} />
          <MapActions
            baseLayer={baseLayer}
            onBaseLayerChange={() => setBaseLayer(baseLayer === 'street' ? 'satellite' : 'street')}
            onBoundary={goToBoundary}
            hasBoundary={project.boundary.length > 0}
            onLocate={locateMe}
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
          />
          <ClickToPlot
            enabled={mode === 'setup' && isPlotting}
            onAddPoint={addBoundaryPoint}
            onMapInteraction={() => setInteractionMode('map')}
          />
          <MapInteractionHandler
            interactionState={interactionState}
            onPointPlaced={(coord) => {
              if (!selectedType || !selectedSubType) return;
              const newFeature: CensusFeature = {
                id: `${Date.now()}`,
                type: selectedType,
                subType: selectedSubType.id,
                geometry: { type: 'Point', coordinates: coord },
                properties: { label: '', timestamp: Date.now() }
              };
              updateProject({ features: [...project.features, newFeature] });
            }}
            onPolylineClick={(coord) => {
              setCurrentDrawingCoords((prev) => [...prev, coord]);
            }}
            onPolylineFinish={finishPolylineDrawing}
          />
          {interactionState === 'drawing_polyline' && currentDrawingCoords.length > 0 && (
            <Polyline
              positions={currentDrawingCoords.map((c) => [c.lat, c.lng])}
              pathOptions={{ color: '#ef4444', weight: 4, dashArray: '5, 10' }}
              interactive={false}
            />
          )}

          {project.layoutImage && overlay && !isBoundaryFocusActive && (
            <LayoutImageOverlay
              image={project.layoutImage}
              overlay={overlay}
              selected={selectedOverlay}
              plotting={isPlotting}
              onSelect={() => {
                setSelectedOverlay(true);
                setInteractionMode('image');
                setIsPlotting(false);
              }}
              onGestureStart={() => setIsOverlayGestureActive(true)}
              onGestureEnd={() => setIsOverlayGestureActive(false)}
              onPreview={(layoutOverlay) => setDraftOverlay(layoutOverlay)}
              onCommit={() => {
                if (draftOverlay) {
                  updateProject({ layoutOverlay: draftOverlay });
                  setDraftOverlay(null);
                }
              }}
            />
          )}

          {currentLocation && (
            <Marker position={toLatLngTuple(currentLocation)} pane={mapPanes.features} zIndexOffset={2000}>
              <Popup>Your current location</Popup>
            </Marker>
          )}

          {project.isBoundaryConfirmed && <BoundaryMask boundary={visibleBoundary} />}
          {visibleBoundary.length > 0 && (
            <>
              {shouldCloseBoundaryPath && (
                <Polygon
                  pane={mapPanes.boundary}
                  positions={visibleBoundary.map(toLatLngTuple)}
                  pathOptions={{
                    color: project.isBoundaryConfirmed ? '#111827' : primaryColor,
                    fillColor: project.isBoundaryConfirmed ? 'transparent' : primaryColor,
                    fillOpacity: project.isBoundaryConfirmed ? 0 : mode === 'setup' ? 0.08 : 0.03,
                    weight: project.isBoundaryConfirmed ? 7 : 6
                  }}
                  interactive={false}
                />
              )}
              <Polyline
                pane={mapPanes.boundary}
                positions={boundaryLine.map(toLatLngTuple)}
                pathOptions={{
                  color: project.isBoundaryConfirmed ? '#111827' : primaryColor,
                  lineCap: 'butt',
                  lineJoin: 'miter',
                  weight: project.isBoundaryConfirmed ? 7 : 4
                }}
                interactive={false}
              />
              {!project.isBoundaryConfirmed && shouldCloseBoundaryPath &&
                project.boundary.map((point, index) => {
                  const nextPoint = project.boundary[(index + 1) % project.boundary.length];
                  if (!nextPoint) return null;

                  return (
                    <Polyline
                      key={`segment-hit-${point.lat}-${point.lng}-${index}`}
                      pane={mapPanes.boundary}
                      positions={[point, nextPoint].map(toLatLngTuple)}
                      className="boundary-segment-hit"
                      pathOptions={{ color: '#000000', opacity: 0, weight: 28 }}
                      eventHandlers={{
                        mousedown: (event) => startBoundarySegmentDrag(index, event)
                      }}
                    />
                  );
                })}
            </>
          )}

          {!project.isBoundaryConfirmed && project.boundary.map((point, index) => (
            <Marker
              key={`${point.lat}-${point.lng}-${index}`}
              position={toLatLngTuple(point)}
              draggable
              pane={mapPanes.boundary}
              zIndexOffset={2500}
              icon={L.divIcon({
                className: 'boundary-point-icon',
                html: `<span><strong>${index + 1}</strong></span>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13]
              })}
              eventHandlers={{
                click: (event) => {
                  event.originalEvent?.stopPropagation();
                },
                mousedown: (event) => {
                  event.originalEvent?.stopPropagation();
                  setInteractionMode('map');
                },
                dragstart: () => {
                  setInteractionMode('map');
                },
                drag: (event) => {
                  const nextPoint = event.target.getLatLng();
                  previewBoundaryPoint(index, { lat: nextPoint.lat, lng: nextPoint.lng });
                },
                dragend: (event) => {
                  const nextPoint = event.target.getLatLng();
                  moveBoundaryPoint(index, { lat: nextPoint.lat, lng: nextPoint.lng });
                },
                contextmenu: (event) => {
                  event.originalEvent?.preventDefault();
                  event.originalEvent?.stopPropagation();
                  event.target.openPopup();
                }
              }}
            >
              <Popup>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteBoundaryPoint(index);
                  }}
                  className="rounded-md px-3 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Delete point {index + 1}
                </button>
              </Popup>
            </Marker>
          ))}

          {autoLayers.buildings.visible &&
            autoLayers.buildings.footprints.map((building) => (
              <Polygon
                key={building.id}
                pane={mapPanes.autoFetch}
                positions={building.ring.map(toLatLngTuple)}
                pathOptions={{
                  color: '#ea580c',
                  weight: 1.5,
                  fillColor: '#fb923c',
                  fillOpacity: 0.28,
                  interactive: false,
                }}
              />
            ))}

          {autoLayers.osmContext.visible && (
            <>
              {autoLayers.osmContext.forests.map((forest) => (
                <Polygon
                  key={forest.id}
                  pane={mapPanes.autoFetch}
                  positions={forest.coordinates.map(toLatLngTuple)}
                  pathOptions={{
                    color: '#166534',
                    weight: 1,
                    fillColor: '#22c55e',
                    fillOpacity: 0.22,
                    interactive: false,
                  }}
                />
              ))}
              {autoLayers.osmContext.waters.map((water) => {
                const closed =
                  water.coordinates.length >= 4 &&
                  Math.abs(water.coordinates[0].lat - water.coordinates[water.coordinates.length - 1].lat) < 1e-7 &&
                  Math.abs(water.coordinates[0].lng - water.coordinates[water.coordinates.length - 1].lng) < 1e-7;
                if (closed || water.kind === 'water' || water.kind === 'pond' || water.kind === 'lake' || water.kind === 'reservoir' || water.kind === 'wetland') {
                  return (
                    <Polygon
                      key={`water-${water.id}`}
                      pane={mapPanes.autoFetch}
                      positions={water.coordinates.map(toLatLngTuple)}
                      pathOptions={{
                        color: '#0369a1',
                        weight: 1.25,
                        fillColor: '#38bdf8',
                        fillOpacity: 0.35,
                        interactive: false,
                      }}
                    />
                  );
                }
                return (
                  <Polyline
                    key={`water-${water.id}`}
                    pane={mapPanes.autoFetch}
                    positions={water.coordinates.map(toLatLngTuple)}
                    pathOptions={{
                      color: '#0284c7',
                      weight: water.kind === 'river' || water.kind === 'stream' ? 2.5 : 2,
                      opacity: 0.85,
                      interactive: false,
                    }}
                  />
                );
              })}
              {autoLayers.osmContext.roads.map((road) => (
                <Polyline
                  key={`road-${road.id}`}
                  pane={mapPanes.autoFetch}
                  positions={road.coordinates.map(toLatLngTuple)}
                  pathOptions={{
                    color: '#57534e',
                    weight: /primary|trunk|motorway/.test(road.highway ?? '') ? 3 : 1.75,
                    opacity: 0.8,
                    interactive: false,
                  }}
                />
              ))}
              {autoLayers.osmContext.landmarks.map((place) => (
                <Marker
                  key={`place-${place.id}`}
                  pane={mapPanes.autoFetch}
                  position={toLatLngTuple(place.coordinate)}
                  interactive={false}
                  icon={L.divIcon({
                    className: 'osm-landmark-icon',
                    html: `<div style="transform:translate(-50%,-100%);white-space:nowrap;padding:2px 6px;border-radius:6px;background:rgba(255,255,255,0.88);backdrop-filter:blur(6px);border:1px solid rgba(0,0,0,0.08);font:600 10px/1.2 system-ui,sans-serif;color:#1c1917;box-shadow:0 1px 4px rgba(0,0,0,0.12)">${place.name.replace(/</g, '&lt;')}</div>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0],
                  })}
                />
              ))}
            </>
          )}

          {project.features.map((tag) => tag.geometry.type === 'Point' ? (
            <Marker
              key={tag.id}
              position={[tag.geometry.coordinates.lat, tag.geometry.coordinates.lng]}
              draggable={true}
              pane={mapPanes.features}
              zIndexOffset={3000}
              icon={createTagIcon(tag as any)}
              eventHandlers={{
                click: () => setEditingTag(tag),
                dragend: (e) => {
                  const newLatLng = e.target.getLatLng();
                  updateProject({
                    features: project.features.map(f =>
                      f.id === tag.id ? { ...f, geometry: { type: 'Point', coordinates: { lat: newLatLng.lat, lng: newLatLng.lng } } } : f
                    )
                  });
                }
              }}
            >
              <Popup className="custom-feature-popup">
                <div className="flex flex-col gap-2 min-w-[180px] pt-1">
                  <div className="flex items-start justify-between gap-3">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Add label..."
                      value={tag.properties.label || ''}
                      onChange={(e) => {
                        updateProject({
                          features: project.features.map(f =>
                            f.id === tag.id ? { ...f, properties: { ...f.properties, label: e.target.value } } : f
                          )
                        });
                      }}
                      className="w-full font-bold text-gray-900 border-none bg-transparent focus:outline-none focus:ring-0 p-0 text-base"
                    />
                    <span className="text-[9px] bg-gray-100 text-gray-500 font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap mt-1">
                      {tag.subType.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
                    <span className="text-xs font-medium text-gray-600">Building size</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Smaller"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          const current = Math.min(2.5, Math.max(0.7, Number(tag.properties.iconScale) || 1));
                          const next = Math.round(Math.max(0.7, current - 0.25) * 100) / 100;
                          updateProject({
                            features: project.features.map((f) =>
                              f.id === tag.id ? { ...f, properties: { ...f.properties, iconScale: next } } : f
                            )
                          });
                        }}
                        className="grid h-7 w-7 place-items-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-800 hover:bg-gray-50"
                      >
                        −
                      </button>
                      <span className="min-w-[2.5rem] text-center text-xs font-semibold text-gray-700">
                        {Math.round((Number(tag.properties.iconScale) || 1) * 100)}%
                      </span>
                      <button
                        type="button"
                        title="Larger"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          const current = Math.min(2.5, Math.max(0.7, Number(tag.properties.iconScale) || 1));
                          const next = Math.round(Math.min(2.5, current + 0.25) * 100) / 100;
                          updateProject({
                            features: project.features.map((f) =>
                              f.id === tag.id ? { ...f, properties: { ...f.properties, iconScale: next } } : f
                            )
                          });
                        }}
                        className="grid h-7 w-7 place-items-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-800 hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ) : tag.geometry.type === 'LineString' ? (
            <PolylineDecorator
              key={tag.id}
              positions={(tag.geometry.coordinates as Coordinate[]).map(c => [c.lat, c.lng])}
              patterns={getLinePattern(tag.type, tag.subType)}
              onClick={() => setEditingTag(tag)}
            />
          ) : null)}
        </MapContainer>

        {mode === 'setup' && (
          <div
            data-export-hidden="true"
            className="absolute inset-x-2 bottom-3 z-[1000] mx-auto max-w-xl rounded-xl border border-gray-200 bg-white/95 p-2 shadow-xl backdrop-blur"
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">
                  Boundary · {project.boundary.length} points{isBoundaryClosed ? ' · closed' : ''}
                </p>
                <p className="truncate text-[11px] font-medium text-gray-500">
                  {interactionMode === 'image' ? 'Image selected' : 'Map selected'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1 overflow-x-auto">
                <ControlButton
                  title={overlay?.isVisible ? 'Hide layout map' : 'Show layout map'}
                  onClick={toggleLayoutMap}
                  active={Boolean(overlay?.isVisible)}
                >
                  {overlay?.isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </ControlButton>
                <ControlButton title="Change uploaded layout image" onClick={onReplaceLayout}>
                  <ImageUp size={18} />
                </ControlButton>
                {overlay && (
                  <ControlButton
                    title={overlay.isLocked ? 'Unlock layout map' : 'Lock layout map'}
                    onClick={() => updateProject({ layoutOverlay: { ...overlay, isLocked: !overlay.isLocked } })}
                    active={overlay.isLocked}
                  >
                    {overlay.isLocked ? <Lock size={17} /> : <Unlock size={17} />}
                  </ControlButton>
                )}
                <ControlButton
                  title={isPlotting ? 'Stop plotting' : 'Start plotting'}
                  onClick={() => {
                    setInteractionMode('map');
                    setSelectedOverlay(false);
                    setIsPlotting(!isPlotting);
                  }}
                  active={isPlotting}
                  disabled={isBoundaryClosed}
                >
                  <Edit3 size={18} />
                </ControlButton>
                <ControlButton
                  title="Undo last boundary point"
                  onClick={undoBoundaryPoint}
                  disabled={project.boundary.length === 0}
                >
                  <RotateCcw size={17} />
                </ControlButton>
                <ControlButton
                  title={isSetupPanelOpen ? 'Minimize toolbar' : 'Expand toolbar'}
                  onClick={() => setIsSetupPanelOpen(!isSetupPanelOpen)}
                  active={isSetupPanelOpen}
                >
                  {isSetupPanelOpen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </ControlButton>
              </div>
            </div>

            <div className="mt-2 flex gap-2">
              <ControlButton title="Delete boundary" onClick={clearBoundary} disabled={project.boundary.length === 0}>
                <Trash2 size={18} />
              </ControlButton>
              <button
                type="button"
                onClick={closeBoundaryLoop}
                disabled={!hasBoundary || isBoundaryClosed}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-white disabled:bg-gray-300"
                style={!hasBoundary || isBoundaryClosed ? undefined : { backgroundColor: '#16a34a' }}
              >
                <Check size={18} />
                Close loop
              </button>
              <button
                type="button"
                onClick={confirmBoundary}
                disabled={!hasBoundary || !isBoundaryClosed}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-white disabled:bg-gray-300"
                style={!hasBoundary || !isBoundaryClosed ? undefined : { backgroundColor: primaryColor }}
              >
                <Check size={18} />
                Confirm boundary
              </button>
            </div>

            {isSetupPanelOpen && (
              <div className="mt-2 grid gap-2 border-t border-gray-100 pt-2">
                {overlay && (
                  <div className="grid gap-2">
                    <div className="grid gap-2 sm:grid-cols-3 sm:items-end">
                      <label className="mb-2 block text-xs font-medium text-blue-950">
                        Opacity
                        <input
                          type="range"
                          min="0.15"
                          max="1"
                          step="0.05"
                          value={overlay.opacity}
                          onChange={(event) => updateProject({ layoutOverlay: { ...overlay, opacity: Number(event.target.value) } })}
                          className="w-full"
                        />
                      </label>
                      <label className="mb-2 block text-xs font-medium text-blue-950">
                        Size
                        <input
                          type="range"
                          min="120"
                          max="1400"
                          step="20"
                          value={overlay.widthMeters}
                          onChange={(event) => {
                            const widthMeters = Number(event.target.value);
                            updateProject({
                              layoutOverlay: {
                                ...overlay,
                                widthMeters,
                                heightMeters: widthMeters / Math.max(0.1, overlay.aspectRatio)
                              }
                            });
                          }}
                          className="w-full"
                        />
                      </label>
                      <label className="block text-xs font-medium text-blue-950">
                        Rotate
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="1"
                          value={overlay.rotation}
                          onChange={(event) => updateProject({ layoutOverlay: { ...overlay, rotation: Number(event.target.value) } })}
                          className="w-full"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {mode === 'field' && (
          <div data-export-hidden="true" className="absolute inset-x-3 bottom-20 z-[1100] flex flex-col gap-2">
            {(autoLayers.buildings.fetched || autoLayers.osmContext.fetched) && (
              <div className="flex flex-wrap gap-2">
                {autoLayers.buildings.fetched && (
                  <button
                    type="button"
                    onClick={toggleBuildingsVisible}
                    className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/55 px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-lg backdrop-blur-md"
                    title={autoLayers.buildings.visible ? 'Hide Google buildings' : 'Show Google buildings'}
                  >
                    <Building2 size={14} className="text-orange-600" />
                    <span>Buildings</span>
                    <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800">
                      Fetched
                    </span>
                    <span className="text-[10px] text-gray-600">{autoLayers.buildings.footprints.length}</span>
                    {autoLayers.buildings.visible ? <Eye size={14} /> : <EyeOff size={14} className="text-gray-400" />}
                  </button>
                )}
                {autoLayers.osmContext.fetched && (
                  <button
                    type="button"
                    onClick={toggleOsmVisible}
                    className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/55 px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-lg backdrop-blur-md"
                    title={autoLayers.osmContext.visible ? 'Hide OSM layers' : 'Show OSM layers'}
                  >
                    <Trees size={14} className="text-green-700" />
                    <span>Roads & landmarks</span>
                    <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800">
                      Fetched
                    </span>
                    {autoLayers.osmContext.visible ? <Eye size={14} /> : <EyeOff size={14} className="text-gray-400" />}
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg font-semibold text-white shadow-lg"
              style={{ backgroundColor: primaryColor }}
            >
              <MapPin size={18} />
              Add tag
            </button>
            <button
              type="button"
              onClick={() => {
                setAutoFetchError(null);
                setIsAutoFetchOpen(true);
              }}
              className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-gray-900 shadow-lg"
              title="Fetch automatically"
            >
              <WandSparkles size={16} />
              Fetch
            </button>
            <a
              href="/sketch"
              draggable={false}
              onPointerDown={prefetchHlbSnapshot}
              onContextMenu={(event) => {
                // Keep browser “Open link in new tab”; stop map from eating the event
                event.stopPropagation();
                prefetchHlbSnapshot();
              }}
              onAuxClick={(event) => {
                // Middle-click new tab
                if (event.button === 1) prefetchHlbSnapshot();
              }}
              onClick={(event) => {
                if (isSketching || isExporting || project.boundary.length < 3) {
                  event.preventDefault();
                  return;
                }
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                  // New-tab / modified click — native href; snapshot from pointerdown
                  return;
                }
                event.preventDefault();
                void goToSketch(event);
              }}
              aria-disabled={isSketching || isExporting || project.boundary.length < 3}
              className={`relative z-[1100] grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white text-gray-900 shadow-lg ${isSketching || isExporting || project.boundary.length < 3
                ? 'pointer-events-none opacity-60'
                : ''
                }`}
              title="HLB map (right-click to open in new tab)"
            >
              {isSketching ? <RefreshCw size={19} className="animate-spin" /> : <Sparkle size={19} />}
            </a>
            <button
              type="button"
              onClick={exportMap}
              disabled={isExporting || isSketching}
              className="grid h-12 w-12 place-items-center rounded-lg bg-white text-gray-900 shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              title="Export map"
            >
              {isExporting ? <RefreshCw size={19} className="animate-spin" /> : <Download size={19} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsBoundaryClosed(project.boundary.length >= 3);
                updateProject({ isBoundaryConfirmed: false });
              }}
              className="grid h-12 w-12 place-items-center rounded-lg bg-white text-gray-900 shadow-lg"
              title="Edit boundary"
            >
              <SquarePen size={19} />
            </button>
            </div>
          </div>
        )}

        <AutoFetchModal
          open={isAutoFetchOpen}
          onClose={() => setIsAutoFetchOpen(false)}
          buildingsFetched={autoLayers.buildings.fetched}
          buildingsLoading={buildingsLoading}
          buildingsProgress={buildingsProgress}
          osmFetched={autoLayers.osmContext.fetched}
          osmLoading={osmLoading}
          error={autoFetchError}
          onFetchBuildings={() => void handleFetchBuildings()}
          onFetchOsm={() => void handleFetchOsm()}
        />

        {/* Old TagEditor references removed */}

        <div data-export-hidden="true" className="pointer-events-none absolute left-3 top-16 z-[900] rounded-lg bg-white/90 px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition-all">
          <Crosshair size={14} className="mr-1 inline" style={{ color: primaryColor }} />
          {tileLayers[baseLayer].label}
        </div>

        {!isSidebarOpen && (mode === 'field' || mode === 'setup') && (
          <button
            data-export-hidden="true"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-3 top-28 z-[900] grid h-10 w-10 place-items-center rounded-lg bg-white/90 text-gray-700 shadow-sm backdrop-blur transition-all hover:bg-white hover:text-gray-900"
            title="Open Map Tools"
          >
            <Menu size={20} />
          </button>
        )}
        {(exportError || locationError) && (
          <div data-export-hidden="true" className="absolute inset-x-3 top-28 z-[1100] rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 shadow-lg">
            <p className="font-semibold">{exportError ?? locationError}</p>
            {exportError && (
              <button
                type="button"
                onClick={exportMap}
                className="mt-2 flex h-8 w-full items-center justify-center gap-1 rounded-md bg-amber-900 font-semibold text-white"
              >
                <RefreshCw size={14} />
                Retry Export
              </button>
            )}
            {locationError && (
              <button
                type="button"
                onClick={locateMe}
                className="mt-2 flex h-8 w-full items-center justify-center gap-1 rounded-md bg-amber-900 font-semibold text-white"
              >
                <RefreshCw size={14} />
                Retry Location
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
