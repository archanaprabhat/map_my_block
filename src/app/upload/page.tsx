'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import MapUploader from '../../components/MapUploader';
import { emptyProject, saveProject, DetectedLocation } from '../../lib/storage';

export default function UploadPage() {
  const router = useRouter();

  const handleSaveLayout = async (base64Image: string, aspectRatio: number, location: DetectedLocation | null) => {
    const nextProject = {
      ...emptyProject,
      layoutImage: base64Image,
      layoutImageAspectRatio: aspectRatio,
      initialLocation: location
    };

    try {
      await saveProject(nextProject);
      // Route directly to map once saved
      router.push('/map');
    } catch (err) {
      console.error('Project save failed', err);
      alert('Could not save to device storage. Please try again.');
    }
  };

  return <MapUploader onSave={handleSaveLayout} />;
}
