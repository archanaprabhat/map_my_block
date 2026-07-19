import { Coordinate } from '../storage';
import {
  OsmPlaceLabel,
  OsmRoad,
  OsmWater,
  isSignificantHighway,
  placePriority,
  pointInPolygon,
} from '../hlb/osmContext';
import { OsmForest } from './types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export type OsmAutoLayersResult = {
  roads: OsmRoad[];
  forests: OsmForest[];
  waters: OsmWater[];
  landmarks: OsmPlaceLabel[];
};

const boundsFromCoords = (coords: Coordinate[], padDeg = 0.002) => {
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
    south: south - padDeg,
    north: north + padDeg,
    west: west - padDeg,
    east: east + padDeg,
  };
};

const wayToCoords = (geom: Array<{ lat: number; lon: number }> | undefined): Coordinate[] => {
  if (!geom?.length) return [];
  return geom.map((g) => ({ lat: g.lat, lng: g.lon }));
};

const centroid = (coords: Coordinate[]): Coordinate | null => {
  if (!coords.length) return null;
  const sum = coords.reduce(
    (acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / coords.length, lng: sum.lng / coords.length };
};

const placeName = (tags: Record<string, string>): string | undefined =>
  tags['name:ml']?.trim() || tags.name?.trim() || undefined;

/**
 * Query OpenStreetMap (Overpass) for roads, rivers/ponds, forests, and landmarks
 * around the confirmed census boundary.
 */
export async function fetchOsmAutoLayers(boundary: Coordinate[]): Promise<OsmAutoLayersResult> {
  if (boundary.length < 3) {
    throw new Error('Confirm a boundary before fetching OSM layers.');
  }

  const b = boundsFromCoords(boundary, 0.003);
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;

  const query = `
[out:json][timeout:45];
(
  way["highway"](${bbox});
  way["waterway"](${bbox});
  way["natural"="water"](${bbox});
  way["landuse"="reservoir"](${bbox});
  way["natural"="wetland"](${bbox});
  relation["natural"="water"](${bbox});
  way["natural"="wood"](${bbox});
  way["landuse"="forest"](${bbox});
  relation["landuse"="forest"](${bbox});
  relation["natural"="wood"](${bbox});
  node["name"]["amenity"](${bbox});
  node["name"]["place"](${bbox});
  node["name"]["leisure"](${bbox});
  node["name"]["tourism"](${bbox});
  node["name"]["natural"](${bbox});
  node["name"]["historic"](${bbox});
  node["name"]["shop"](${bbox});
  node["name"]["office"](${bbox});
  node["name"]["waterway"](${bbox});
  node["name:ml"]["amenity"](${bbox});
  node["name:ml"]["place"](${bbox});
  node["name:ml"]["leisure"](${bbox});
  node["name:ml"]["natural"](${bbox});
  way["name"]["natural"](${bbox});
  way["name"]["landuse"](${bbox});
  way["name"]["waterway"](${bbox});
  way["name"]["leisure"](${bbox});
  way["name"]["amenity"](${bbox});
  way["name"]["tourism"](${bbox});
  way["name"]["historic"](${bbox});
  way["name:ml"]["natural"](${bbox});
  way["name:ml"]["leisure"](${bbox});
  way["name:ml"]["amenity"](${bbox});
  way["name:ml"]["waterway"](${bbox});
);
out body geom;
`.trim();

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Accept: 'application/json',
      'User-Agent': 'MapMyBlock-Census2027/1.0',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`OSM fetch failed (${response.status})`);
  }

  const data = (await response.json()) as {
    elements?: Array<{
      type: string;
      id: number;
      lat?: number;
      lon?: number;
      tags?: Record<string, string>;
      geometry?: Array<{ lat: number; lon: number }>;
    }>;
  };

  const roads: OsmRoad[] = [];
  const forests: OsmForest[] = [];
  const waters: OsmWater[] = [];
  const landmarks: OsmPlaceLabel[] = [];
  const seenPlaceNames = new Set<string>();

  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};

    if (el.type === 'way' && tags.highway) {
      const coordinates = wayToCoords(el.geometry);
      if (coordinates.length >= 2 && isSignificantHighway(tags.highway)) {
        roads.push({
          id: el.id,
          name: placeName(tags),
          highway: tags.highway,
          coordinates,
        });
      }
    }

    const isForest =
      (el.type === 'way' || el.type === 'relation') &&
      (tags.natural === 'wood' || tags.landuse === 'forest');
    if (isForest) {
      const coordinates = wayToCoords(el.geometry);
      if (coordinates.length >= 3) {
        forests.push({
          id: `forest-${el.id}`,
          name: placeName(tags),
          coordinates,
        });
      }
    }

    const isWaterWay =
      el.type === 'way' &&
      (Boolean(tags.waterway) ||
        tags.natural === 'water' ||
        tags.landuse === 'reservoir' ||
        tags.natural === 'wetland');
    if (isWaterWay) {
      const coordinates = wayToCoords(el.geometry);
      if (coordinates.length >= 2) {
        waters.push({
          id: el.id,
          name: placeName(tags),
          kind: tags.waterway || tags.natural || tags.landuse || 'water',
          coordinates,
        });
      }
    }

    const name = placeName(tags);
    if (!name || seenPlaceNames.has(name.toLowerCase())) continue;

    let coordinate: Coordinate | null = null;
    const kind =
      tags.amenity ||
      tags.place ||
      tags.natural ||
      tags.leisure ||
      tags.tourism ||
      tags.historic ||
      tags.landuse ||
      tags.waterway ||
      'place';

    if (el.type === 'node' && el.lat != null && el.lon != null) {
      coordinate = { lat: el.lat, lng: el.lon };
    } else if (el.type === 'way' && !tags.highway && !isForest) {
      coordinate = centroid(wayToCoords(el.geometry));
    }

    if (!coordinate) continue;

    const priority = placePriority(name, kind);
    if (priority < 80) continue;

    // Prefer landmarks near / inside the block, but keep significant nearby ones
    const nearBlock =
      pointInPolygon(coordinate, boundary) ||
      Math.abs(coordinate.lat - boundary[0].lat) < 0.02;

    if (!nearBlock && priority < 88) continue;

    seenPlaceNames.add(name.toLowerCase());
    landmarks.push({ id: el.id, name, kind, coordinate, priority });
  }

  landmarks.sort((a, b) => b.priority - a.priority || a.name.length - b.name.length);

  return {
    roads,
    forests,
    waters,
    landmarks: landmarks.slice(0, 80),
  };
}
