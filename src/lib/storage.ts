import localforage from 'localforage';
import { withTimeout } from './reliability';

export type Coordinate = {
  lat: number;
  lng: number;
};

export type DetectedLocation = {
  lat: number;
  lng: number;
  displayName: string;
};

export type TagType = 'GoodBuilding' | 'Badbuilding' | 'roads' | 'water' | 'religious' | 'institutions';

export type FeatureGeometry = 
  | { type: 'Point'; coordinates: Coordinate }
  | { type: 'LineString'; coordinates: Coordinate[] };

export type CensusFeature = {
  id: string;
  type: TagType;
  subType: string;
  geometry: FeatureGeometry;
  properties: {
    label?: string;
    timestamp: number;
    [key: string]: any;
  };
};

export type LayoutOverlay = {
  center: Coordinate;
  widthMeters: number;
  heightMeters: number;
  aspectRatio: number;
  rotation: number;
  opacity: number;
  isLocked: boolean;
  isVisible: boolean;
};

export type CensusProject = {
  layoutImage: string | null;
  layoutImageAspectRatio: number;
  layoutOverlay: LayoutOverlay | null;
  boundary: Coordinate[];
  isBoundaryConfirmed: boolean;
  features: CensusFeature[];
  initialLocation: DetectedLocation | null;
};

const PROJECT_KEY = 'census-mapper-project-v3';

export const emptyProject: CensusProject = {
  layoutImage: null,
  layoutImageAspectRatio: 1,
  layoutOverlay: null,
  boundary: [],
  isBoundaryConfirmed: false,
  features: [],
  initialLocation: null
};

const normalizeProject = (project: Partial<CensusProject> | null): CensusProject => {
  const layoutImageAspectRatio = project?.layoutImageAspectRatio ?? project?.layoutOverlay?.aspectRatio ?? 1;
  const overlayAspectRatio = project?.layoutOverlay?.aspectRatio ?? layoutImageAspectRatio;

  return {
    ...emptyProject,
    ...project,
    layoutImageAspectRatio,
    features: project?.features ?? [],
    boundary: project?.boundary ?? [],
    initialLocation: project?.initialLocation ?? null,
    layoutOverlay: project?.layoutOverlay
      ? {
          ...project.layoutOverlay,
          aspectRatio: overlayAspectRatio,
          heightMeters: project.layoutOverlay.aspectRatio
            ? project.layoutOverlay.heightMeters
            : project.layoutOverlay.widthMeters / Math.max(0.1, overlayAspectRatio)
        }
      : null
  };
};

export const getProject = async (): Promise<CensusProject> => {
  if (typeof window === 'undefined') return emptyProject;

  try {
    const project = await withTimeout(
      localforage.getItem<CensusProject>(PROJECT_KEY),
      8000,
      'Project loading timed out'
    );
    return normalizeProject(project);
  } catch (err) {
    console.error('Error loading project', err);
    return emptyProject;
  }
};

export const saveProject = async (project: CensusProject): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    await withTimeout(localforage.setItem(PROJECT_KEY, project), 8000, 'Project saving timed out');
  } catch (err) {
    console.error('Error saving project', err);
    throw err;
  }
};

export const clearProject = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    await withTimeout(localforage.removeItem(PROJECT_KEY), 8000, 'Project clearing timed out');
  } catch (err) {
    console.error('Error clearing project', err);
    throw err;
  }
};
