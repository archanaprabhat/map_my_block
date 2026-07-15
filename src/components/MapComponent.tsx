'use client';

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents, useMap, ImageOverlay } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GeoTag, Coordinate } from '../lib/storage';
import { Locate, Search, MapPin } from 'lucide-react';

// Fix for default Leaflet marker icons in Next.js/React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapComponentProps {
  markers: GeoTag[];
  boundary: Coordinate[];
  activeTab: 'setup' | 'field-tag' | 'block-map';
  onMapClick?: (lat: number, lng: number) => void;
  center?: [number, number];
  layoutImage?: string | null;
}

const MapEvents = ({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

interface SearchResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

const MapController = () => {
  const map = useMap();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced Search Effect
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 3) {
        setSuggestions([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&viewbox=74.5,8.0,77.5,13.0&bounded=1&limit=5`);
        const data = await res.json();
        setSuggestions(data || []);
      } catch (err) {
        console.error("Failed to fetch suggestions", err);
      } finally {
        setIsSearching(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchSuggestions();
    }, 500); // 500ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          map.flyTo([latitude, longitude], 18);
        },
        (error) => {
          alert('Unable to retrieve your location.');
          console.error(error);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSelectSuggestion = (suggestion: SearchResult) => {
    map.flyTo([parseFloat(suggestion.lat), parseFloat(suggestion.lon)], 16);
    setSearchQuery(suggestion.display_name);
    setSuggestions([]);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0]);
    }
  };

  return (
    <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col space-y-2 pointer-events-none" ref={dropdownRef}>
      <div className="relative pointer-events-auto">
        <form onSubmit={handleSearchSubmit} className="flex space-x-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in Kerala..."
            className="flex-1 bg-white p-3 rounded-xl shadow-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
          />
          <button 
            type="button"
            onClick={handleLocateMe}
            className="bg-white text-gray-800 p-3 rounded-xl shadow-lg border border-gray-200 hover:bg-gray-50 transition flex items-center justify-center"
            title="Locate Me"
          >
            <Locate size={20} className="text-blue-600" />
          </button>
        </form>

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <ul className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 max-h-60 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <li 
                key={suggestion.place_id}
                onClick={() => handleSelectSuggestion(suggestion)}
                className="flex items-start p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition"
              >
                <MapPin size={16} className="text-gray-400 mt-1 mr-2 shrink-0" />
                <span className="text-sm text-gray-700 truncate">{suggestion.display_name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default function MapComponent({ markers, boundary, activeTab, onMapClick, center, layoutImage }: MapComponentProps) {
  // Default to somewhere in Kerala (Kochi)
  const [mapCenter, setMapCenter] = useState<[number, number]>(center || [9.9312, 76.2673]);

  const getImageBounds = (): L.LatLngBoundsExpression | null => {
    if (boundary.length < 2) return null;
    const lats = boundary.map(c => c.lat);
    const lngs = boundary.map(c => c.lng);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    ];
  };

  const imageBounds = getImageBounds();

  useEffect(() => {
    if (center) {
      setMapCenter(center);
    } else if (boundary.length > 0) {
      setMapCenter([boundary[0].lat, boundary[0].lng]);
    } else if (markers.length > 0) {
      setMapCenter([markers[0].lat, markers[0].lng]);
    }
  }, [center, boundary, markers]);

  return (
    <MapContainer
      center={mapCenter}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapController />

      {activeTab === 'setup' && <MapEvents onMapClick={onMapClick} />}

      {boundary.length > 0 && (
        <Polygon 
          positions={boundary.map(c => [c.lat, c.lng] as [number, number])} 
          pathOptions={{ color: 'blue', fillColor: 'transparent', weight: 2 }}
        />
      )}

      {layoutImage && imageBounds && (
        <ImageOverlay
          url={layoutImage}
          bounds={imageBounds}
          opacity={0.6}
          zIndex={10}
        />
      )}

      {markers.map((marker) => (
        <Marker key={marker.id} position={[marker.lat, marker.lng]}>
          <Popup>
            <div className="text-center">
              <strong className="block text-lg">House: {marker.sequenceNumber}</strong>
              <span className="text-sm text-gray-500">
                {new Date(marker.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
