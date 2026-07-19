import { Coordinate } from '../storage';
import { OsmPlaceLabel, OsmRoad, OsmWater } from '../hlb/osmContext';

export type BuildingFootprint = {
  id: string;
  ring: Coordinate[];
  confidence?: number;
  areaInMeters?: number;
  source?: string;
};

export type OsmForest = {
  id: string;
  name?: string;
  coordinates: Coordinate[];
};

export type BuildingsLayerState = {
  fetched: boolean;
  visible: boolean;
  fetchedAt?: number;
  footprints: BuildingFootprint[];
};

export type OsmContextLayerState = {
  fetched: boolean;
  visible: boolean;
  fetchedAt?: number;
  roads: OsmRoad[];
  forests: OsmForest[];
  waters: OsmWater[];
  landmarks: OsmPlaceLabel[];
};

export type AutoFetchLayers = {
  buildings: BuildingsLayerState;
  osmContext: OsmContextLayerState;
};

export const emptyAutoFetchLayers = (): AutoFetchLayers => ({
  buildings: { fetched: false, visible: false, footprints: [] },
  osmContext: {
    fetched: false,
    visible: false,
    roads: [],
    forests: [],
    waters: [],
    landmarks: [],
  },
});
