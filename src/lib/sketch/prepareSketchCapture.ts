import L from 'leaflet';
import { CensusFeature, Coordinate, TagType } from '../storage';
import { SketchOverlay, SketchPointPx } from './sketchPipeline';

const pointKind = (type: TagType, subType: string): SketchPointPx['kind'] => {
  if (type === 'GoodBuilding' || type === 'Badbuilding') {
    return subType.includes('non-residential') ? 'nonResidential' : 'residential';
  }
  if (type === 'religious') return 'religious';
  if (type === 'institutions') return 'institution';
  if (type === 'water') return 'water';
  return 'other';
};

const toPx = (map: L.Map, coord: Coordinate, pixelRatio: number) => {
  const p = map.latLngToContainerPoint([coord.lat, coord.lng]);
  return { x: p.x * pixelRatio, y: p.y * pixelRatio };
};

/** Build OpenCV overlay geometry from the live Leaflet map (image pixel space). */
export function buildSketchOverlay(
  map: L.Map,
  boundary: Coordinate[],
  features: CensusFeature[],
  pixelRatio: number
): SketchOverlay | null {
  if (boundary.length < 3) return null;

  const size = map.getSize();
  const imageWidth = Math.round(size.x * pixelRatio);
  const imageHeight = Math.round(size.y * pixelRatio);

  const boundaryPx = boundary.map((c) => toPx(map, c, pixelRatio));
  const roads: SketchOverlay['roads'] = [];
  const points: SketchPointPx[] = [];

  for (const feature of features) {
    if (feature.geometry.type === 'LineString') {
      const line = feature.geometry.coordinates.map((c) => toPx(map, c, pixelRatio));
      if (line.length >= 2) roads.push(line);
      continue;
    }
    if (feature.geometry.type === 'Point') {
      const p = toPx(map, feature.geometry.coordinates, pixelRatio);
      points.push({
        x: p.x,
        y: p.y,
        kind: pointKind(feature.type, feature.subType),
        label: feature.properties.label,
      });
    }
  }

  return {
    boundary: boundaryPx,
    roads,
    points,
    imageWidth,
    imageHeight,
  };
}

export function waitForMapIdle(map: L.Map, ms = 900): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      map.off('moveend', onMoveEnd);
      resolve();
    };
    const onMoveEnd = () => {
      window.setTimeout(done, ms);
    };
    map.once('moveend', onMoveEnd);
    // If already idle / no move, still wait for tiles
    window.setTimeout(done, ms + 200);
  });
}

export function fitMapToBoundary(map: L.Map, boundary: Coordinate[], padding = 36) {
  if (boundary.length < 3) return;
  const latLngs = boundary.map((c) => L.latLng(c.lat, c.lng));
  const bounds = L.latLngBounds(latLngs);
  map.fitBounds(bounds, { padding: [padding, padding], animate: false, maxZoom: 19 });
}
