'use client';

import React, { useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import Cropper, { ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { UploadCloud, Check, X } from 'lucide-react';

const primaryColor = '#21216b';

interface MapUploaderProps {
  onSave: (base64Image: string, aspectRatio: number) => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
}

export default function MapUploader({
  onSave,
  onCancel,
  title = 'Upload Layout Map',
  description = 'Upload the government-issued Houselisting Block layout map to use as a reference.'
}: MapUploaderProps) {
  const [image, setImage] = useState<string | null>(null);
  const [isCropperReady, setIsCropperReady] = useState(false);
  const cropperRef = useRef<ReactCropperElement>(null);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = () => {
        setIsCropperReady(false);
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
    const cropper = cropperRef.current?.cropper;
    const croppedCanvas = cropper?.getCroppedCanvas({
      maxWidth: 2048,
      maxHeight: 2048
    });

    if (croppedCanvas) {
      const croppedImage = croppedCanvas.toDataURL('image/jpeg', 0.8);
      const aspectRatio = croppedCanvas.width / croppedCanvas.height || 1;
      onSave(croppedImage, aspectRatio);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col items-center">
        <div className="mb-2 flex w-full items-start justify-between gap-3">
          <h2 className="text-2xl font-bold text-gray-800 text-center flex-1">{title}</h2>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
              title="Cancel"
              aria-label="Cancel"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <p className="text-gray-500 text-center text-sm mb-6">{description}</p>

        {!image ? (
          <div
            {...getRootProps()}
            className={`w-full border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragActive ? 'bg-indigo-50' : 'border-gray-300 hover:bg-gray-50'
            }`}
            style={isDragActive ? { borderColor: primaryColor } : undefined}
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
                ready={() => setIsCropperReady(true)}
              />
            </div>
            
            <div className="flex w-full space-x-3">
              <button
                onClick={() => {
                  setImage(null);
                  setIsCropperReady(false);
                }}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCropAndSave}
                disabled={!isCropperReady}
                className="flex-[2] py-3 px-4 text-white font-medium rounded-xl transition flex items-center justify-center shadow-md active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none disabled:active:scale-100"
                style={isCropperReady ? { backgroundColor: primaryColor } : undefined}
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
