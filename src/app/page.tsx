'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Map, User } from 'lucide-react';
import MapUploader from '../components/MapUploader';
import { CensusProject, clearProject, emptyProject, getProject, saveProject } from '../lib/storage';

const MapComponent = dynamic(() => import('../components/MapComponent'), {
  ssr: false,
  loading: () => <div className="grid h-dvh w-screen place-items-center bg-white text-sm font-medium text-blue-600">Loading map...</div>
});

type MainTab = 'map' | 'profile';

export default function Home() {
  const [project, setProject] = useState<CensusProject>(emptyProject);
  const [activeTab, setActiveTab] = useState<MainTab>('map');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isReplacingLayout, setIsReplacingLayout] = useState(false);

  useEffect(() => {
    const loadProject = async () => {
      const savedProject = await getProject();
      setProject(savedProject);
      setIsInitializing(false);
    };

    loadProject();
  }, []);

  const updateProject = async (nextProject: CensusProject) => {
    setProject(nextProject);
    await saveProject(nextProject);
  };

  const handleSaveLayout = async (base64Image: string, aspectRatio: number) => {
    await updateProject({
      ...emptyProject,
      layoutImage: base64Image,
      layoutImageAspectRatio: aspectRatio
    });
  };

  const replaceLayoutImage = async (base64Image: string, aspectRatio: number) => {
    await updateProject({
      ...project,
      layoutImage: base64Image,
      layoutImageAspectRatio: aspectRatio,
      layoutOverlay: null,
      boundary: [],
      isBoundaryConfirmed: false
    });
    setActiveTab('map');
    setIsReplacingLayout(false);
  };

  const requestReplaceLayout = () => {
    const confirmed = window.confirm('Changing the layout image will clear the current overlay alignment and boundary. Continue?');
    if (confirmed) setIsReplacingLayout(true);
  };

  const resetProject = async () => {
    const confirmed = window.confirm('Are you sure you want to delete this map and all tags? This cannot be undone.');
    if (!confirmed) return;

    await clearProject();
    setProject(emptyProject);
    setActiveTab('map');
  };

  if (isInitializing) {
    return <div className="grid h-dvh w-screen place-items-center bg-white text-sm font-medium text-blue-600">Initializing...</div>;
  }

  if (!project.layoutImage) {
    return <MapUploader onSave={handleSaveLayout} />;
  }

  if (isReplacingLayout) {
    return (
      <MapUploader
        onSave={replaceLayoutImage}
        onCancel={() => setIsReplacingLayout(false)}
        title="Change Layout Map"
        description="Upload and crop the replacement map. Your tags stay saved, but overlay alignment and boundary setup will be redone."
      />
    );
  }

  const mode = project.isBoundaryConfirmed ? 'field' : 'setup';

  return (
    <div className="h-dvh w-screen overflow-hidden bg-white">
      <MapComponent
        project={project}
        mode={mode}
        activeTab={activeTab}
        onProjectChange={updateProject}
        onResetProject={resetProject}
        onReplaceLayout={requestReplaceLayout}
      />

      {mode === 'field' && (
        <nav className="fixed inset-x-0 bottom-0 z-[1600] grid h-16 grid-cols-2 border-t border-gray-200 bg-white shadow-[0_-2px_12px_rgba(15,23,42,0.08)]">
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${
              activeTab === 'map' ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <Map size={21} />
            Map
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${
              activeTab === 'profile' ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <User size={21} />
            Profile
          </button>
        </nav>
      )}
    </div>
  );
}
