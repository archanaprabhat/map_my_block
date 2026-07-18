import { CensusProject } from './storage';

export const exportGeoJSON = (project: CensusProject) => {
  const geojson = {
    type: 'FeatureCollection',
    features: project.features.map((feature) => ({
      type: 'Feature',
      id: feature.id,
      geometry: {
        type: feature.geometry.type,
        coordinates:
          feature.geometry.type === 'Point'
            ? [feature.geometry.coordinates.lng, feature.geometry.coordinates.lat]
            : (feature.geometry.coordinates as any[]).map((coord: any) => [coord.lng, coord.lat])
      },
      properties: {
        type: feature.type,
        subType: feature.subType,
        ...feature.properties
      }
    }))
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(geojson, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', 'census_map_export.geojson');
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};
