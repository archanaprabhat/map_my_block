'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { BottomNav, Tab } from '../components/BottomNav';
import { getMarkers, saveMarker, getBoundary, saveBoundary, GeoTag, Coordinate, getLayoutMap, saveLayoutMap } from '../lib/storage';
import MapUploader from '../components/MapUploader';

const MapComponent = dynamic(() => import('../components/MapComponent'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full w-full bg-gray-100 text-gray-500">Loading Map...</div>
});

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('setup');
  const [markers, setMarkers] = useState<GeoTag[]>([]);
  const [boundary, setBoundary] = useState<Coordinate[]>([]);
  const [houseNumber, setHouseNumber] = useState<string>('1');
  const [layoutImage, setLayoutImage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initData = async () => {
      setMarkers(getMarkers());
      setBoundary(getBoundary());
      const savedLayout = await getLayoutMap();
      if (savedLayout) {
        setLayoutImage(savedLayout);
      }
      setIsInitializing(false);
    };
    initData();
  }, []);

  const handleSaveLayout = async (base64Image: string) => {
    await saveLayoutMap(base64Image);
    setLayoutImage(base64Image);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (activeTab === 'setup') {
      const newBoundary = [...boundary, { lat, lng }];
      setBoundary(newBoundary);
      saveBoundary(newBoundary);
    }
  };

  const handleClearBoundary = () => {
    setBoundary([]);
    saveBoundary([]);
  };

  const handleGeoTag = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        const newMarker: GeoTag = {
          id: Date.now().toString(),
          lat: latitude,
          lng: longitude,
          sequenceNumber: houseNumber,
          timestamp: Date.now()
        };
        
        const newMarkers = [...markers, newMarker];
        setMarkers(newMarkers);
        saveMarker(newMarker);
        
        // Auto-increment logic
        const currentNum = parseInt(houseNumber.replace(/\D/g, ''), 10);
        if (!isNaN(currentNum)) {
          setHouseNumber((currentNum + 1).toString());
        }
      }, (error) => {
        alert("Unable to retrieve your location. Please check your permissions.");
        console.error(error);
      }, {
        enableHighAccuracy: true
      });
    } else {
      alert("Geolocation is not supported by your browser");
    }
  };

  const handleExport = () => {
    alert("Simulating UPI payment to unlock Export... SUCCESS! Map Exported (Line Art Style implementation pending).");
  };

  if (isInitializing) {
    return <div className="h-screen w-screen flex items-center justify-center bg-white text-blue-600 font-medium">Initializing...</div>;
  }

  // Show Onboarding if no layout image exists
  if (!layoutImage) {
    return <MapUploader onSave={handleSaveLayout} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
      
      {/* Top Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md z-10">
        <h1 className="text-xl font-bold">CensusBlock Mapper</h1>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative">
        
        {/* The Map */}
        <div className="absolute inset-0 z-0">
          <MapComponent 
            markers={markers} 
            boundary={boundary} 
            activeTab={activeTab} 
            onMapClick={handleMapClick}
            layoutImage={layoutImage}
          />
        </div>

        {/* Tab Overlays */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col pointer-events-none">
          
          {/* Setup Tab UI */}
          {activeTab === 'setup' && (
            <div className="bg-white/90 backdrop-blur p-4 rounded-t-2xl shadow-lg pointer-events-auto m-2 mb-20 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-2">Define Boundary</h2>
              <p className="text-sm text-gray-600 mb-4">Tap on the map to draw the custom operational boundary for this Houselisting Block. The uploaded layout map will automatically stretch across this boundary.</p>
              <div className="flex space-x-2">
                <button 
                  onClick={handleClearBoundary}
                  className="flex-1 bg-red-100 text-red-600 font-medium py-2 px-4 rounded-lg active:bg-red-200 transition"
                >
                  Clear Area
                </button>
                <button 
                  onClick={() => setActiveTab('field-tag')}
                  className="flex-1 bg-blue-600 text-white font-medium py-2 px-4 rounded-lg shadow-md active:bg-blue-700 transition"
                >
                  Lock & Start
                </button>
              </div>
            </div>
          )}

          {/* Field Tag Tab UI */}
          {activeTab === 'field-tag' && (
            <div className="bg-white/90 backdrop-blur p-4 rounded-t-2xl shadow-lg pointer-events-auto m-2 mb-20 border border-gray-200 flex flex-col items-center">
               <div className="w-full mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">House Sequence Number</label>
                  <input 
                    type="text" 
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    className="w-full text-center text-2xl font-bold p-3 border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. 201"
                  />
               </div>
               <button 
                  onClick={handleGeoTag}
                  className="w-full bg-green-500 text-white text-xl font-bold py-4 rounded-2xl shadow-[0_4px_14px_0_rgba(34,197,94,0.39)] active:scale-95 transition-transform"
                >
                  TAG LOCATION
               </button>
            </div>
          )}

          {/* Block Map / Export Tab UI */}
          {activeTab === 'block-map' && (
            <div className="bg-white/90 backdrop-blur p-4 rounded-t-2xl shadow-lg pointer-events-auto m-2 mb-20 border border-gray-200">
               <div className="flex justify-between items-center mb-4">
                 <div>
                   <h2 className="text-lg font-bold text-gray-800">Map Dashboard</h2>
                   <p className="text-sm text-gray-600">Total Houses: {markers.length}</p>
                 </div>
               </div>
               
               <button 
                  onClick={handleExport}
                  className="w-full bg-black text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg active:scale-95 transition-transform"
                >
                  <span>Export Final Map (Pay ₹10)</span>
               </button>
            </div>
          )}
        </div>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
