import localforage from 'localforage';
import type { CensusProject } from '../storage';
import { emptyAutoFetchLayers } from '../autoFetch/types';

const HLB_PROJECT_KEY = 'map-my-block-hlb-project';
const HLB_RESULT_KEY = 'map-my-block-hlb-result';

let memoryProject: CensusProject | null = null;
let memoryResult: string | null = null;

const store = localforage.createInstance({
  name: 'map-my-block-hlb',
  storeName: 'transfer',
});

/**
 * Drop layout imagery. Keep auto-fetch layers that are visible on the map
 * so the HLB canvas matches what the enumerator sees (hidden layers omitted).
 */
export const slimHlbProject = (project: CensusProject): CensusProject => {
  const empty = emptyAutoFetchLayers();
  const layers = project.autoFetchLayers;
  const buildings = layers?.buildings;
  const osm = layers?.osmContext;

  return {
    ...project,
    layoutImage: null,
    layoutOverlay: null,
    autoFetchLayers: {
      buildings:
        buildings?.fetched && buildings.visible
          ? {
              fetched: true,
              visible: true,
              fetchedAt: buildings.fetchedAt,
              footprints: buildings.footprints.map((f) => ({
                ...f,
                ring: f.ring.map((c) => ({ ...c })),
              })),
            }
          : {
              ...empty.buildings,
              fetched: Boolean(buildings?.fetched),
              visible: false,
            },
      osmContext:
        osm?.fetched && osm.visible
          ? {
              fetched: true,
              visible: true,
              fetchedAt: osm.fetchedAt,
              roads: osm.roads.map((r) => ({
                ...r,
                coordinates: r.coordinates.map((c) => ({ ...c })),
              })),
              forests: osm.forests.map((f) => ({
                ...f,
                coordinates: f.coordinates.map((c) => ({ ...c })),
              })),
              waters: osm.waters.map((w) => ({
                ...w,
                coordinates: w.coordinates.map((c) => ({ ...c })),
              })),
              landmarks: osm.landmarks.map((p) => ({
                ...p,
                coordinate: { ...p.coordinate },
              })),
            }
          : {
              ...empty.osmContext,
              fetched: Boolean(osm?.fetched),
              visible: false,
            },
    },
    features: project.features.map((f) => ({ ...f, properties: { ...f.properties } })),
    boundary: project.boundary.map((c) => ({ ...c })),
  };
};

const writeLocalMirror = (project: CensusProject) => {
  try {
    localStorage.setItem(HLB_PROJECT_KEY, JSON.stringify(project));
  } catch {
    /* quota / private mode — IndexedDB remains source of truth */
  }
};

const readLocalMirror = (): CensusProject | null => {
  try {
    const raw = localStorage.getItem(HLB_PROJECT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CensusProject;
  } catch {
    return null;
  }
};

/** Snapshot project for vector HLB render (no screenshot / OpenCV). */
export async function setHlbProject(project: CensusProject): Promise<void> {
  const slim = slimHlbProject(project);
  memoryProject = slim;
  memoryResult = null;
  // Sync mirror so right-click → new tab can read immediately (same origin).
  writeLocalMirror(slim);
  try {
    await store.setItem(HLB_PROJECT_KEY, slim);
    await store.removeItem(HLB_RESULT_KEY);
  } catch (err) {
    console.warn('Could not persist HLB project snapshot', err);
  }
}

export async function getHlbProject(): Promise<CensusProject | null> {
  if (memoryProject) return memoryProject;

  const mirrored = readLocalMirror();
  if (mirrored && mirrored.boundary?.length >= 3) {
    memoryProject = mirrored;
    return mirrored;
  }

  try {
    const stored = await store.getItem<CensusProject>(HLB_PROJECT_KEY);
    if (stored) {
      memoryProject = stored;
      return stored;
    }
  } catch (err) {
    console.warn('Could not read HLB project snapshot', err);
  }
  return null;
}

export async function setHlbResult(dataUrl: string): Promise<void> {
  memoryResult = dataUrl;
  try {
    await store.setItem(HLB_RESULT_KEY, dataUrl);
  } catch {
    /* large PNG may exceed IDB in rare cases — memory is enough for session */
  }
}

export async function getHlbResult(): Promise<string | null> {
  if (memoryResult) return memoryResult;
  try {
    return (await store.getItem<string>(HLB_RESULT_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function clearHlbTransfer(): Promise<void> {
  memoryResult = null;
  try {
    await store.removeItem(HLB_RESULT_KEY);
  } catch {
    /* ignore */
  }
}
