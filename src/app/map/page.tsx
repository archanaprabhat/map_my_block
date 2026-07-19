'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Map, RefreshCw, User } from 'lucide-react';
import MapUploader from '../../components/MapUploader';
import { CensusProject, clearProject, emptyProject, getProject, saveProject, DetectedLocation } from '../../lib/storage';
import { useAppLanguage } from '../../hooks/useAppLanguage';

const primaryColor = '#212121';
const activeTabKey = 'map-my-block-active-tab';
const projectRecoveryKey = 'map-my-block-project-recovery';

const MapComponent = dynamic(() => import('../../components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh w-screen place-items-center bg-white text-sm font-medium" style={{ color: primaryColor }}>
      Loading map...
    </div>
  )
});

type MainTab = 'map' | 'profile';

export default function MapPage() {
  const router = useRouter();
  const { t } = useAppLanguage();
  const [project, setProject] = useState<CensusProject>(emptyProject);
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    if (typeof window === 'undefined') return 'map';
    const savedTab = window.localStorage.getItem(activeTabKey);
    return savedTab === 'profile' ? 'profile' : 'map';
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const [isReplacingLayout, setIsReplacingLayout] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const latestProjectRef = useRef(project);

  useEffect(() => {
    let isMounted = true;

    const loadProject = async () => {
      try {
        const savedProject = await getProject();
        const recoveryProject = window.sessionStorage.getItem(projectRecoveryKey);
        const nextProject = recoveryProject ? (JSON.parse(recoveryProject) as CensusProject) : savedProject;
        if (!isMounted) return;
        
        // If there is no layout image, they shouldn't be on the map yet.
        if (!nextProject.layoutImage) {
          router.push('/upload');
          return;
        }

        setProject(nextProject);
        latestProjectRef.current = nextProject;
        if (recoveryProject) setSaveError('Recovered unsaved changes. Tap retry to save them permanently.');
      } catch (err) {
        console.error('Project initialization failed', err);
        if (isMounted) setSaveError('Saved map could not be loaded. Restart the app or retry.');
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    };

    loadProject();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    latestProjectRef.current = project;
  }, [project]);

  useEffect(() => {
    window.localStorage.setItem(activeTabKey, activeTab);
  }, [activeTab]);

  const updateProject = async (nextProject: CensusProject) => {
    window.sessionStorage.setItem(projectRecoveryKey, JSON.stringify(nextProject));
    setProject(nextProject);
    latestProjectRef.current = nextProject;

    try {
      await saveProject(nextProject);
      window.sessionStorage.removeItem(projectRecoveryKey);
      setSaveError(null);
    } catch (err) {
      console.error('Project save failed', err);
      setSaveError('Changes are kept on this screen but could not be saved to device storage.');
    }
  };

  const retrySaveProject = async () => {
    const nextProject = latestProjectRef.current;

    try {
      await saveProject(nextProject);
      window.sessionStorage.removeItem(projectRecoveryKey);
      setSaveError(null);
    } catch (err) {
      console.error('Project retry save failed', err);
      setSaveError('Still unable to save. Keep the app open and retry when storage is available.');
    }
  };

  const replaceLayoutImage = async (base64Image: string, aspectRatio: number, location: DetectedLocation | null) => {
    await updateProject({
      ...project,
      layoutImage: base64Image,
      layoutImageAspectRatio: aspectRatio,
      layoutOverlay: null,
      boundary: [],
      isBoundaryConfirmed: false,
      initialLocation: location
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

    try {
      await clearProject();
      window.sessionStorage.removeItem(projectRecoveryKey);
      setProject(emptyProject);
      latestProjectRef.current = emptyProject;
      setActiveTab('map');
      setSaveError(null);
      // Route back to home when deleted completely
      router.push('/');
    } catch (err) {
      console.error('Project reset failed', err);
      setSaveError('Could not delete saved map. Please retry.');
    }
  };

  if (isInitializing) {
    return (
      <div className="grid h-dvh w-screen place-items-center bg-white text-sm font-medium" style={{ color: primaryColor }}>
        Initializing...
      </div>
    );
  }

  if (isReplacingLayout) {
    return (
      <MapUploader
        onSave={replaceLayoutImage}
        onCancel={() => setIsReplacingLayout(false)}
        title={t('Change Layout Map', 'ലേഔട്ട് മാപ്പ് മാറ്റുക')}
        description={t(
          'Upload and crop the replacement map. Your tags stay saved, but overlay alignment and boundary setup will be redone.',
          'പുതിയ ലേഔട്ട് മാപ്പ് അപ്‌ലോഡ് ചെയ്ത് ക്രോപ്പ് ചെയ്യുക. ടാഗുകൾ സൂക്ഷിക്കും; ഓവർലേ വിന്യാസവും അതിർത്തി സജ്ജീകരണവും വീണ്ടും ചെയ്യേണ്ടി വരും.'
        )}
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

      {saveError && (
        <div className="fixed inset-x-3 top-16 z-[2500] rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950 shadow-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Storage needs attention</p>
              <p className="mt-1 text-xs">{saveError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={retrySaveProject}
            className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-amber-900 text-sm font-semibold text-white"
          >
            <RefreshCw size={15} />
            Retry Save
          </button>
        </div>
      )}

      {mode === 'field' && (
        <nav
          className="fixed inset-x-0 bottom-0 z-[1600] grid grid-cols-2 border-t border-gray-200 bg-white shadow-[0_-2px_12px_rgba(15,23,42,0.08)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', minHeight: '4rem' }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className="flex min-h-16 touch-manipulation flex-col items-center justify-center gap-1 text-xs font-medium"
            style={{ color: activeTab === 'map' ? primaryColor : '#6b7280' }}
          >
            <Map size={21} />
            Map
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="flex min-h-16 touch-manipulation flex-col items-center justify-center gap-1 text-xs font-medium"
            style={{ color: activeTab === 'profile' ? primaryColor : '#6b7280' }}
          >
            <User size={21} />
            Profile
          </button>
        </nav>
      )}
    </div>
  );
}
