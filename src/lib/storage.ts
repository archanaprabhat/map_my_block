import localforage from 'localforage';

export type GeoTag = {
  id: string;
  lat: number;
  lng: number;
  sequenceNumber: string;
  timestamp: number;
};

export type Coordinate = {
  lat: number;
  lng: number;
};

const MARKERS_KEY = 'census-mapper-markers';
const BOUNDARY_KEY = 'census-mapper-boundary';
const LAYOUT_MAP_KEY = 'census-mapper-layout-image';

export const saveMarker = (marker: GeoTag) => {
  if (typeof window === 'undefined') return;
  const markers = getMarkers();
  markers.push(marker);
  localStorage.setItem(MARKERS_KEY, JSON.stringify(markers));
};

export const updateMarker = (id: string, updatedMarker: Partial<GeoTag>) => {
  if (typeof window === 'undefined') return;
  const markers = getMarkers();
  const index = markers.findIndex(m => m.id === id);
  if (index !== -1) {
    markers[index] = { ...markers[index], ...updatedMarker };
    localStorage.setItem(MARKERS_KEY, JSON.stringify(markers));
  }
};

export const getMarkers = (): GeoTag[] => {
  if (typeof window === 'undefined') return [];
  const markers = localStorage.getItem(MARKERS_KEY);
  return markers ? JSON.parse(markers) : [];
};

export const saveBoundary = (coordinates: Coordinate[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BOUNDARY_KEY, JSON.stringify(coordinates));
};

export const getBoundary = (): Coordinate[] => {
  if (typeof window === 'undefined') return [];
  const boundary = localStorage.getItem(BOUNDARY_KEY);
  return boundary ? JSON.parse(boundary) : [];
};

export const saveLayoutMap = async (base64Image: string): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    await localforage.setItem(LAYOUT_MAP_KEY, base64Image);
  } catch (err) {
    console.error("Error saving layout map", err);
  }
};

export const getLayoutMap = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;
  try {
    return await localforage.getItem<string>(LAYOUT_MAP_KEY);
  } catch (err) {
    console.error("Error getting layout map", err);
    return null;
  }
};

export const clearData = async () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MARKERS_KEY);
  localStorage.removeItem(BOUNDARY_KEY);
  await localforage.removeItem(LAYOUT_MAP_KEY);
};
