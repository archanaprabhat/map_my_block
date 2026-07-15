import React from 'react';
import { Map, MapPin, Grid } from 'lucide-react';

export type Tab = 'setup' | 'field-tag' | 'block-map';

interface BottomNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50">
      <button
        onClick={() => setActiveTab('setup')}
        className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
          activeTab === 'setup' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        <Grid size={24} />
        <span className="text-xs font-medium">Setup</span>
      </button>

      <button
        onClick={() => setActiveTab('field-tag')}
        className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
          activeTab === 'field-tag' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        <div className={`p-2 rounded-full ${activeTab === 'field-tag' ? 'bg-blue-100' : 'bg-transparent'}`}>
          <MapPin size={24} />
        </div>
        <span className="text-xs font-medium">Field Tag</span>
      </button>

      <button
        onClick={() => setActiveTab('block-map')}
        className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
          activeTab === 'block-map' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        <Map size={24} />
        <span className="text-xs font-medium">Block Map</span>
      </button>
    </div>
  );
};
