import { geojson as flatgeobuf } from 'flatgeobuf';
import { Coordinate } from '../storage';
import { pointInPolygon } from '../hlb/osmContext';
import { BuildingFootprint } from './types';

const OPEN_BUILDINGS_FGB =
  'https://data.source.coop/vida/google-microsoft-open-buildings/flatgeobuf/by_country/country_iso=IND/IND.fgb';

const MIN_CONFIDENCE = 0.7;
const MAX_BUILDINGS = 2500;

const boundsFromCoords = (coords: Coordinate[], padDeg = 0.0008) => {
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const c of coords) {
    south = Math.min(south, c.lat);
    north = Math.max(north, c.lat);
    west = Math.min(west, c.lng);
    east = Math.max(east, c.lng);
  }
  return {
    minX: west - padDeg,
    minY: south - padDeg,
    maxX: east + padDeg,
    maxY: north + padDeg,
  };
};

const ringCentroid = (ring: Coordinate[]): Coordinate | null => {
  if (!ring.length) return null;
  const sum = ring.reduce(
    (acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / ring.length, lng: sum.lng / ring.length };
};

/** Convert GeoJSON polygon outer ring [lng,lat][] → Coordinate[] */
const toRing = (coords: number[][]): Coordinate[] =>
  coords
    .filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map((c) => ({ lng: c[0], lat: c[1] }));

/**
 * Fetch Google Open Buildings footprints that intersect the confirmed census boundary.
 * Uses VIDA's cloud-native FlatGeobuf (Google + Microsoft), filtered to Google source
 * via HTTP range requests — only the AOI is downloaded, not the full India file.
 */
export async function fetchGoogleOpenBuildings(
  boundary: Coordinate[],
  onProgress?: (count: number) => void
): Promise<BuildingFootprint[]> {
  if (boundary.length < 3) {
    throw new Error('Confirm a boundary before fetching buildings.');
  }

  const rect = boundsFromCoords(boundary);
  const footprints: BuildingFootprint[] = [];
  let index = 0;

  const iter = flatgeobuf.deserialize(OPEN_BUILDINGS_FGB, rect);

  for await (const feature of iter) {
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const source = String(props.bf_source ?? props.source ?? '').toLowerCase();
    // Prefer Google Open Buildings; skip Microsoft/OSM rows in the combined dataset
    if (source && source !== 'google') continue;

    const confidence =
      typeof props.confidence === 'number'
        ? props.confidence
        : typeof props.confidence === 'string'
          ? Number(props.confidence)
          : undefined;
    if (confidence != null && Number.isFinite(confidence) && confidence < MIN_CONFIDENCE) {
      continue;
    }

    const geometry = feature.geometry;
    if (!geometry) continue;

    let ring: Coordinate[] = [];
    if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates?.[0])) {
      ring = toRing(geometry.coordinates[0] as number[][]);
    } else if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates?.[0]?.[0])) {
      ring = toRing(geometry.coordinates[0][0] as number[][]);
    }
    if (ring.length < 3) continue;

    const centroid = ringCentroid(ring);
    if (!centroid || !pointInPolygon(centroid, boundary)) continue;

    footprints.push({
      id: `gob-${index++}`,
      ring,
      confidence: confidence != null && Number.isFinite(confidence) ? confidence : undefined,
      areaInMeters:
        typeof props.area_in_meters === 'number'
          ? props.area_in_meters
          : typeof props.area_in_meters === 'string'
            ? Number(props.area_in_meters)
            : undefined,
      source: 'Google',
    });

    if (footprints.length % 25 === 0) onProgress?.(footprints.length);
    if (footprints.length >= MAX_BUILDINGS) break;
  }

  onProgress?.(footprints.length);
  return footprints;
}
