import { Coordinate } from '../storage';
import {
  OsmPlaceLabel,
  OsmRoad,
  OsmWater,
  isSignificantHighway,
  placePriority,
  pointInPolygon,
} from '../hlb/osmContext';
import { postOverpassQuery } from '../overpass';
import { OsmForest } from './types';

export type OsmAutoLayersResult = {
  roads: OsmRoad[];
  forests: OsmForest[];
  waters: OsmWater[];
  landmarks: OsmPlaceLabel[];
};

const boundsFromCoords = (coords: Coordinate[], padDeg = 0.0015) => {
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

  // Cap pad so huge / sloppy boundaries don't kill Overpass
  const latSpan = Math.min(0.04, Math.max(0.004, north - south + padDeg * 2));
  const lngSpan = Math.min(0.04, Math.max(0.004, east - west + padDeg * 2));
  const latMid = (south + north) / 2;
  const lngMid = (west + east) / 2;

  return {
    south: latMid - latSpan / 2,
    north: latMid + latSpan / 2,
    west: lngMid - lngSpan / 2,
    east: lngMid + lngSpan / 2,
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

  const b = boundsFromCoords(boundary, 0.002);
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;

  // Lean query — fewer selectors = fewer 504s on public Overpass mirrors
  const query = `
[out:json][timeout:25];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)$"](${bbox});
  way["waterway"~"^(river|stream|canal|drain)$"](${bbox});
  way["natural"="water"](${bbox});
  way["landuse"="reservoir"](${bbox});
  way["natural"="wood"](${bbox});
  way["landuse"="forest"](${bbox});
  node["name"]["amenity"](${bbox});
  node["name"]["place"](${bbox});
  node["name"]["leisure"](${bbox});
  node["name"]["tourism"](${bbox});
  node["name"]["historic"](${bbox});
  node["name"]["natural"](${bbox});
);
out body geom;
`.trim();

  const response = await postOverpassQuery(query);
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
      el.type === 'way' && (tags.natural === 'wood' || tags.landuse === 'forest');
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
