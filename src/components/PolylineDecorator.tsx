import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-polylinedecorator';

interface PolylineDecoratorProps {
  positions: L.LatLngTuple[] | L.LatLngTuple[][];
  patterns: L.Pattern[];
  onClick?: () => void;
}

export default function PolylineDecorator({ positions, patterns, onClick }: PolylineDecoratorProps) {
  const map = useMap();

  useEffect(() => {
    if (!positions || positions.length === 0) return;

    // Invisible base line to hold the decorators
    const polyline = L.polyline(positions, { opacity: 0 }); 
    const decorator = L.polylineDecorator(polyline, {
      patterns
    });

    if (onClick) {
      decorator.on('click', (e) => {
        L.DomEvent.stopPropagation(e as unknown as Event);
        onClick();
      });
    }

    decorator.addTo(map);

    return () => {
      map.removeLayer(decorator);
    };
  }, [map, positions, patterns, onClick]);

  return null;
}
