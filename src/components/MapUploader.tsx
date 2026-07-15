'use client';

import React, { useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import Cropper, { ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { UploadCloud, Check } from 'lucide-react';

interface MapUploaderProps {
  onSave: (base64Image: string) => void;
}

export default function MapUploader({ onSave }: MapUploaderProps) {
  const [image, setImage] = useState<string | null>(null);
  const cropperRef = useRef<ReactCropperElement>(null);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  });

  const handleCropAndSave = () => {
    if (typeof cropperRef.current?.cropper !== 'undefined') {
      // Get the cropped image data as a base64 string
      const croppedImage = cropperRef.current?.cropper.getCroppedCanvas({
        maxWidth: 2048,
        maxHeight: 2048
      }).toDataURL('image/jpeg', 0.8);
      onSave(croppedImage);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col items-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Upload Layout Map</h2>
        <p className="text-gray-500 text-center text-sm mb-6">
          Upload the government-issued Houselisting Block layout map to use as a reference.
        </p>

        {!image ? (
          <div
            {...getRootProps()}
            className={`w-full border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud size={48} className="text-gray-400 mb-4" />
            <p className="text-gray-600 font-medium text-center">
              {isDragActive ? 'Drop image here...' : 'Tap to upload or drag and drop'}
            </p>
            <p className="text-xs text-gray-400 mt-2 text-center">PNG, JPG up to 10MB</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            <div className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4 border border-gray-200">
              <Cropper
                ref={cropperRef}
                style={{ height: '100%', width: '100%' }}
                zoomTo={0.5}
                initialAspectRatio={1}
                src={image}
                viewMode={1}
                minCropBoxHeight={100}
                minCropBoxWidth={100}
                background={false}
                responsive={true}
                autoCropArea={1}
                checkOrientation={false} // https://github.com/fengyuanchen/cropperjs/issues/671
                guides={true}
              />
            </div>
            
            <div className="flex w-full space-x-3">
              <button
                onClick={() => setImage(null)}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCropAndSave}
                className="flex-[2] py-3 px-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition flex items-center justify-center shadow-md active:scale-95"
              >
                <Check size={20} className="mr-2" />
                Crop & Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
