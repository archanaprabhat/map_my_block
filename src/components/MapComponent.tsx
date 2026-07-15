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
  Move,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Trash2,
  Unlock,
  X
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { CensusProject, Coordinate, GeoTag, LayoutOverlay, TagType } from '../lib/storage';

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
const primaryColor = '#21216b';
const tagColors: Record<TagType, string> = {
  house: primaryColor,
  business: '#f97316',
  school: '#16a34a',
  other: '#7c3aed'
};

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
  tags: 'tag-pane'
} as const;

const mapLayerZIndexes = {
  layoutOverlay: 550,
  boundaryMask: 560,
  boundary: 700,
  tags: 740
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

const createTagIcon = (tag: GeoTag) =>
  L.divIcon({
    className: 'census-tag-icon',
    html: `<span style="background:${tagColors[tag.type]}">${tag.label}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
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
    className={`grid h-11 w-11 place-items-center rounded-lg border text-gray-800 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
      active ? 'text-white' : 'border-gray-200 bg-white hover:bg-gray-50'
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
    <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
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
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    if (query.trim().length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
          { signal: controller.signal }
        );
        const data = (await response.json()) as SearchResult[];
        setResults(data);
      } catch (err) {
        if (!controller.signal.aborted) console.error('Search failed', err);
      }
    }, 450);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

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
    <div className="absolute left-3 right-[4.25rem] top-3 z-[1000]">
      <form className="relative" onSubmit={submitSearch}>
        <Search size={18} className="pointer-events-none absolute left-3 top-3.5 text-gray-400" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveResult(null);
            if (event.target.value.trim().length < 3) setResults([]);
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
      [mapPanes.tags, mapLayerZIndexes.tags]
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
  onChange
}: {
  image: string;
  overlay: LayoutOverlay;
  selected: boolean;
  plotting: boolean;
  onSelect: () => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onChange: (overlay: LayoutOverlay) => void;
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
    const crs = map.options.crs ?? L.CRS.EPSG3857;
    const projectedCenter = crs.project(centerLatLng);
    const projectedScale = 1 / Math.max(0.000001, Math.cos((overlay.center.lat * Math.PI) / 180));
    const halfWidth = (overlay.widthMeters * projectedScale) / 2;
    const heightMeters = overlay.heightMeters || overlay.widthMeters / Math.max(0.1, overlay.aspectRatio);
    const halfHeight = (heightMeters * projectedScale) / 2;
    const west = map.latLngToContainerPoint(crs.unproject(L.point(projectedCenter.x - halfWidth, projectedCenter.y)));
    const east = map.latLngToContainerPoint(crs.unproject(L.point(projectedCenter.x + halfWidth, projectedCenter.y)));
    const north = map.latLngToContainerPoint(crs.unproject(L.point(projectedCenter.x, projectedCenter.y + halfHeight)));
    const south = map.latLngToContainerPoint(crs.unproject(L.point(projectedCenter.x, projectedCenter.y - halfHeight)));
    const width = Math.abs(east.x - west.x);
    const height = Math.abs(north.y - south.y);

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
      onChange({ ...overlay, center: { lat: nextCenter.lat, lng: nextCenter.lng } });
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
      onChange({ ...overlay, widthMeters, heightMeters: widthMeters / Math.max(0.1, overlay.aspectRatio) });
      return;
    }

    const center = map.latLngToContainerPoint([overlay.center.lat, overlay.center.lng]);
    const angle = Math.atan2(pointer.y - center.y, pointer.x - center.x);
    const delta = ((angle - (start.startAngle ?? angle)) * 180) / Math.PI;
    onChange({ ...overlay, rotation: (start.rotation ?? overlay.rotation) + delta });
  };

  const endTransform = () => {
    onGestureEnd();
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
      className={`absolute touch-none select-none ${
        selected ? 'outline outline-3' : 'outline outline-1 outline-white/70'
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

function TagEditor({
  initial,
  onSave,
  onDelete,
  onClose
}: {
  initial?: GeoTag;
  onSave: (data: { label: string; type: TagType; otherLabel?: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [type, setType] = useState<TagType>(initial?.type ?? 'house');
  const [otherLabel, setOtherLabel] = useState(initial?.otherLabel ?? '');

  return (
    <div className="fixed inset-0 z-[2000] grid place-items-end bg-black/35 p-3 sm:place-items-center">
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{initial ? 'Edit tag' : 'Add tag'}</h2>
        <label className="mb-3 block text-sm font-medium text-gray-700">
          Number or name
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            autoFocus
            className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-base text-gray-900 outline-none focus:border-blue-600"
            placeholder="House 12, Shop A, School"
          />
        </label>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(['house', 'business', 'school', 'other'] as TagType[]).map((tagType) => (
            <button
              key={tagType}
              type="button"
              onClick={() => setType(tagType)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize ${type === tagType ? 'bg-indigo-50' : 'border-gray-200 text-gray-700'}`}
              style={type === tagType ? { borderColor: primaryColor, color: primaryColor } : undefined}
            >
              {tagType}
            </button>
          ))}
        </div>
        {type === 'other' && (
          <label className="mb-3 block text-sm font-medium text-gray-700">
            Specify type
            <input
              value={otherLabel}
              onChange={(event) => setOtherLabel(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-base text-gray-900 outline-none focus:border-blue-600"
              placeholder="Temple, office, vacant plot"
            />
          </label>
        )}
        <div className="flex gap-2">
          {onDelete && (
            <button type="button" onClick={onDelete} className="grid h-11 w-11 place-items-center rounded-lg bg-red-50 text-red-600">
              <Trash2 size={18} />
            </button>
          )}
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-lg bg-gray-100 font-medium text-gray-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ label: label.trim(), type, otherLabel: otherLabel.trim() || undefined })}
            disabled={!label.trim()}
            className="h-11 flex-1 rounded-lg font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MapComponent({ project, mode, activeTab, onProjectChange, onResetProject, onReplaceLayout }: MapComponentProps) {
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('street');
  const [isPlotting, setIsPlotting] = useState(false);
  const [selectedOverlay, setSelectedOverlay] = useState(false);
  const [interactionMode, setInteractionMode] = useState<'map' | 'image'>('map');
  const [isSetupPanelOpen, setIsSetupPanelOpen] = useState(false);
  const [isOverlayGestureActive, setIsOverlayGestureActive] = useState(false);
  const [isBoundaryClosed, setIsBoundaryClosed] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinate>({ lat: defaultCenter[0], lng: defaultCenter[1] });
  const [overlayFocus, setOverlayFocus] = useState<Coordinate>({ lat: defaultCenter[0], lng: defaultCenter[1] });
  const [draftBoundary, setDraftBoundary] = useState<Coordinate[] | null>(null);
  const [isBoundarySegmentDragging, setIsBoundarySegmentDragging] = useState(false);
  const [editingTag, setEditingTag] = useState<GeoTag | null>(null);
  const [isAddingTag, setIsAddingTag] = useState(false);
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
  const overlay = project.layoutOverlay;
  const hasBoundary = project.boundary.length >= 3;
  const isBoundaryFocusActive = project.isBoundaryConfirmed;
  const centerForOverlay = overlayFocus;
  const visibleBoundary = draftBoundary ?? project.boundary;
  const shouldCloseBoundaryPath = isBoundaryClosed || project.isBoundaryConfirmed;
  const boundaryLine = shouldCloseBoundaryPath && visibleBoundary.length > 0 ? [...visibleBoundary, visibleBoundary[0]] : visibleBoundary;

  const fitBoundary = useMemo(() => (project.isBoundaryConfirmed ? project.boundary : []), [project.isBoundaryConfirmed, project.boundary]);

  const focusOverlayAt = (coordinate: Coordinate) => {
    setOverlayFocus(coordinate);
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      alert('Location is not supported on this device.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinate = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentLocation(coordinate);
        focusOverlayAt(coordinate);
        mapRef.current?.flyTo(toLatLngTuple(coordinate), 18);
      },
      () => alert('Unable to get location. Please allow location access for this site.'),
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
    updateProject({ boundary: project.boundary.filter((_, pointIndex) => pointIndex !== index), isBoundaryConfirmed: false });
    setIsBoundaryClosed(false);
  };

  const undoBoundaryPoint = () => {
    updateProject({ boundary: project.boundary.slice(0, -1), isBoundaryConfirmed: false });
    setIsBoundaryClosed(false);
  };

  const clearBoundary = () => {
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

    updateProject({ layoutOverlay: createDefaultOverlay(centerForOverlay, project.layoutImageAspectRatio) });
    setSelectedOverlay(true);
    setInteractionMode('image');
    setIsSetupPanelOpen(true);
  };

  const saveTag = (data: { label: string; type: TagType; otherLabel?: string }) => {
    if (editingTag) {
      updateProject({
        tags: project.tags.map((tag) => (tag.id === editingTag.id ? { ...tag, ...data } : tag))
      });
      setEditingTag(null);
      return;
    }

    const coordinate = currentLocation ?? mapCenter;
    if (!isPointInsideBoundary(coordinate, project.boundary)) {
      const shouldContinue = window.confirm('This point is outside your confirmed boundary. Add it anyway?');
      if (!shouldContinue) return;
    }

    const nextTag: GeoTag = {
      id: `${Date.now()}`,
      lat: coordinate.lat,
      lng: coordinate.lng,
      timestamp: Date.now(),
      ...data
    };

    updateProject({ tags: [...project.tags, nextTag] });
    setIsAddingTag(false);
  };

  const deleteTag = (id: string) => {
    updateProject({ tags: project.tags.filter((tag) => tag.id !== id) });
    setEditingTag(null);
  };

  const exportMap = async () => {
    if (!exportRef.current) return;

    try {
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.exportHidden === 'true')
      });
      const link = document.createElement('a');
      link.download = `census-map-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Map export failed', err);
      alert('Export failed. Try switching to road map and export again.');
    }
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
              <strong className="text-lg text-gray-900">{project.tags.length}</strong>
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
        </div>
      </div>
    );
  }

  return (
    <div ref={exportRef} className="relative h-dvh w-screen overflow-hidden bg-white">
      <MapContainer center={defaultCenter} zoom={16} minZoom={mapMinZoom} maxZoom={mapMaxZoom} zoomControl={false} className="h-full w-full">
        <MapBridge onReady={handleMapReady} onCenterChange={handleCenterChange} />
        <MapLayerPanes />
        <MapGestureMode locked={mode === 'setup' && (isOverlayGestureActive || isBoundarySegmentDragging)} />
        <LocateOnMount
          onLocation={(coordinate) => {
            setCurrentLocation(coordinate);
            focusOverlayAt(coordinate);
          }}
        />
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
            onChange={(layoutOverlay) => updateProject({ layoutOverlay })}
          />
        )}

        {currentLocation && (
          <Marker position={toLatLngTuple(currentLocation)} pane={mapPanes.tags} zIndexOffset={2000}>
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

        {project.tags.map((tag) => (
          <Marker
            key={tag.id}
            position={[tag.lat, tag.lng]}
            pane={mapPanes.tags}
            zIndexOffset={3000}
            icon={createTagIcon(tag)}
            eventHandlers={{ click: () => setEditingTag(tag) }}
          >
            <Popup>
              <strong>{tag.label}</strong>
              <br />
              <span>{tag.type === 'other' ? tag.otherLabel ?? 'Other' : tag.type}</span>
            </Popup>
          </Marker>
        ))}
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
        <div data-export-hidden="true" className="absolute inset-x-3 bottom-20 z-[1000] flex gap-2">
          <button
            type="button"
            onClick={() => setIsAddingTag(true)}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg font-semibold text-white shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <MapPin size={18} />
            Add tag
          </button>
          <button type="button" onClick={exportMap} className="grid h-12 w-12 place-items-center rounded-lg bg-white text-gray-900 shadow-lg" title="Export map">
            <Download size={19} />
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
            <Move size={19} />
          </button>
        </div>
      )}

      {isAddingTag && <TagEditor onClose={() => setIsAddingTag(false)} onSave={saveTag} />}
      {editingTag && (
        <TagEditor
          initial={editingTag}
          onClose={() => setEditingTag(null)}
          onSave={saveTag}
          onDelete={() => deleteTag(editingTag.id)}
        />
      )}

      <div data-export-hidden="true" className="pointer-events-none absolute left-3 top-16 z-[900] rounded-lg bg-white/90 px-3 py-2 text-xs font-medium text-gray-700 shadow-sm">
        <Crosshair size={14} className="mr-1 inline" style={{ color: primaryColor }} />
        {tileLayers[baseLayer].label}
      </div>
    </div>
  );
}
