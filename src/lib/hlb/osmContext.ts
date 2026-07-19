import { Coordinate } from '../storage';
import { postOverpassQuery } from '../overpass';

export type OsmRoad = {
  id: number;
  name?: string;
  highway?: string;
  coordinates: Coordinate[];
};

export type OsmPlaceLabel = {
  id: number;
  name: string;
  kind: string;
  coordinate: Coordinate;
  /** Higher = more important for Census sheet labelling. */
  priority: number;
};

export type OsmWater = {
  id: number;
  name?: string;
  kind: string;
  coordinates: Coordinate[];
};

export type OsmContext = {
  roads: OsmRoad[];
  places: OsmPlaceLabel[];
  waters: OsmWater[];
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
  return {
    south: south - padDeg,
    north: north + padDeg,
    west: west - padDeg,
    east: east + padDeg,
  };
};

/** Ray-cast point-in-polygon (lat/lng treated as planar locally). */
export const pointInPolygon = (point: Coordinate, polygon: Coordinate[]): boolean => {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
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

/** Schools, grounds, ponds, rivers, temples, etc. — always keep on the sheet. */
export const placePriority = (name: string, kind: string): number => {
  const blob = `${name} ${kind}`.toLowerCase();
  if (/school|college|university|vidyalaya|സ്കൂൾ/.test(blob)) return 100;
  if (/hospital|phc|clinic|dispensary/.test(blob)) return 95;
  if (/temple|church|mosque|gurudwara|കോവിൽ|പള്ളി|ക്ഷേത്രം/.test(blob)) return 90;
  if (/pond|lake|kulam|tank|reservoir|കുളം/.test(blob)) return 88;
  if (/river|stream|canal|waterway|പുഴ|കനാൽ/.test(blob)) return 86;
  if (/ground|playground|park|stadium|മൈതാനം/.test(blob)) return 84;
  if (/panchayat|post.?office|library|police/.test(blob)) return 80;
  if (/amenity|place|leisure|natural/.test(blob)) return 40;
  return 20;
};

export const isSignificantHighway = (highway?: string): boolean =>
  /primary|secondary|tertiary|trunk|unclassified|residential|motorway/.test(highway ?? '');

/**
 * Fetch OSM highways, waterways, and named places around the HLB boundary
 * (surrounding context for Census labelling — never drop significant nearby names).
 */
export async function fetchOsmContext(boundary: Coordinate[]): Promise<OsmContext> {
  if (boundary.length < 3) return { roads: [], places: [], waters: [] };

  // Wider fetch so schools / ponds / rivers just outside the block are available
  const b = boundsFromCoords(boundary, 0.005);
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;

  const query = `
[out:json][timeout:25];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"](${bbox});
  way["waterway"~"^(river|stream|canal)$"](${bbox});
  way["natural"="water"](${bbox});
  way["landuse"="reservoir"](${bbox});
  node["name"]["amenity"](${bbox});
  node["name"]["place"](${bbox});
  node["name"]["leisure"](${bbox});
  node["name"]["tourism"](${bbox});
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
  const places: OsmPlaceLabel[] = [];
  const waters: OsmWater[] = [];
  const seenPlaceNames = new Set<string>();

  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};

    if (el.type === 'way' && tags.highway) {
      const coordinates = wayToCoords(el.geometry);
      if (coordinates.length >= 2) {
        roads.push({
          id: el.id,
          name: placeName(tags),
          highway: tags.highway,
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
    let kind =
      tags.amenity ||
      tags.place ||
      tags.natural ||
      tags.leisure ||
      tags.landuse ||
      tags.waterway ||
      'place';

    if (el.type === 'node' && el.lat != null && el.lon != null) {
      coordinate = { lat: el.lat, lng: el.lon };
    } else if (el.type === 'way' && !tags.highway) {
      coordinate = centroid(wayToCoords(el.geometry));
    }

    if (!coordinate) continue;

    const priority = placePriority(name, kind);
    // Significant labels only (schools, ponds, temples, grounds…) — inside or outside HLB
    if (priority < 80) continue;

    seenPlaceNames.add(name.toLowerCase());
    places.push({ id: el.id, name, kind, coordinate, priority });
  }

  // Significant first, then keep a healthy set for surrounding context
  places.sort((a, b) => b.priority - a.priority || a.name.length - b.name.length);
  return {
    roads,
    places: places.slice(0, 60),
    waters,
  };
}
