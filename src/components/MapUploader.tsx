'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Cropper, { ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { UploadCloud, Check, X, Search, ChevronDown, ChevronUp, ArrowRight, ArrowLeft } from 'lucide-react';
import { extractCoordinates, reverseGeocode } from '../lib/location';
import { DetectedLocation } from '../lib/storage';

const primaryColor = '#000';
const draftImageKey = 'map-my-block-upload-draft';
const maxUploadBytes = 10 * 1024 * 1024;

interface MapUploaderProps {
  onSave: (base64Image: string, aspectRatio: number, location: DetectedLocation | null) => Promise<void> | void;
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
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [croppedData, setCroppedData] = useState<{ image: string; aspectRatio: number } | null>(null);

  const [image, setImage] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(draftImageKey);
  });
  const [isCropperReady, setIsCropperReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Location Detection State
  const [smsText, setSmsText] = useState('');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  const cropperRef = useRef<ReactCropperElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processLocationLookup = async (lat: number, lng: number) => {
    if (detectedLocation && detectedLocation.lat === lat && detectedLocation.lng === lng) {
      return;
    }

    setLocationStatus('loading');
    setLocationError(null);
    try {
      const location = await reverseGeocode({ lat, lng });
      setDetectedLocation(location);
      setLocationStatus('success');
    } catch (err) {
      setDetectedLocation(null);
      setLocationError("Couldn't detect coordinates or location from the pasted text.");
      setLocationStatus('error');
    }
  };

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!smsText.trim()) {
      setLocationStatus('idle');
      setLocationError(null);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      const coords = extractCoordinates(smsText);
      if (coords) {
        processLocationLookup(coords.lat, coords.lng);
      } else {
        setDetectedLocation(null);
        setLocationError("Couldn't detect coordinates from the pasted text.");
        setLocationStatus('error');
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [smsText]);

  const handleManualSearch = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      processLocationLookup(lat, lng);
    } else {
      setLocationError("Invalid latitude or longitude.");
      setLocationStatus('error');
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setErrorMessage(null);
      if (file.size > maxUploadBytes) {
        setErrorMessage('Image is larger than 10MB. Please choose a smaller file.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setIsCropperReady(false);
        const nextImage = reader.result as string;
        setImage(nextImage);
        try {
          window.sessionStorage.setItem(draftImageKey, nextImage);
        } catch (e) {
          console.warn('Session storage quota exceeded, skipping draft save.');
        }
      };
      reader.onerror = () => {
        setErrorMessage('Could not read this image. Please try another file.');
      };
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxSize: maxUploadBytes,
    multiple: false,
    onDropRejected: () => setErrorMessage('Only image files up to 10MB can be uploaded.')
  });

  const handleNextStep = () => {
    const cropper = cropperRef.current?.cropper;
    const croppedCanvas = cropper?.getCroppedCanvas({
      maxWidth: 2048,
      maxHeight: 2048
    });

    if (!croppedCanvas) {
      setErrorMessage('Cropper is not ready yet. Please retry in a moment.');
      return;
    }

    setErrorMessage(null);
    const croppedImage = croppedCanvas.toDataURL('image/jpeg', 0.8);
    const aspectRatio = croppedCanvas.width / croppedCanvas.height || 1;
    setCroppedData({ image: croppedImage, aspectRatio });
    setCurrentStep(2);
  };

  const handleFinishSetup = async () => {
    if (!croppedData) return;
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await onSave(croppedData.image, croppedData.aspectRatio, detectedLocation);
      window.sessionStorage.removeItem(draftImageKey);
    } catch (err) {
      console.error('Layout save failed', err);
      setErrorMessage('Could not save the setup. Please retry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-center w-full h-screen bg-cover bg-center p-4 relative"
      style={{ backgroundImage: 'url(/cover.png)' }}
    >
      <div className="absolute inset-0 bg-black/10 z-0" />

      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px] min-h-[520px] p-6 flex flex-col items-stretch relative z-10 transition-all duration-300">
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

        {errorMessage && (
          <div className="mb-4 w-full rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Step 1 */}
        {currentStep === 1 && (
          <div className="flex flex-col w-full flex-1 animate-in fade-in zoom-in-95 duration-300">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Layout Image</h3>
            <p className="text-gray-500 text-sm mb-4">{description}</p>

            {!image ? (
              <>
                <div
                  {...getRootProps()}
                  className={`w-full h-[280px] border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragActive ? 'bg-gray-100' : 'border-gray-300 hover:bg-gray-50'
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
                <div className="flex w-full space-x-3 mt-auto h-[48px]"></div>
              </>
            ) : (
              <div className="w-full flex-1 flex flex-col items-center">
                <div className="w-full h-[280px] bg-gray-100 rounded-lg overflow-hidden mb-4 border border-gray-200">
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
                    checkOrientation={false}
                    guides={true}
                    ready={() => setIsCropperReady(true)}
                  />
                </div>

                <div className="flex w-full space-x-3 mt-auto">
                  <button
                    onClick={() => {
                      setImage(null);
                      setIsCropperReady(false);
                      setErrorMessage(null);
                      window.sessionStorage.removeItem(draftImageKey);
                    }}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNextStep}
                    disabled={!isCropperReady}
                    className="flex-1 py-3 px-4 text-white font-medium rounded-xl transition flex items-center justify-center shadow-md active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none disabled:active:scale-100"
                    style={isCropperReady ? { backgroundColor: primaryColor } : undefined}
                  >
                    Next <ArrowRight size={18} className="ml-2" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2 */}
        {currentStep === 2 && (
          <div className="flex flex-col w-full flex-1 animate-in fade-in zoom-in-95 duration-300">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Detect Location</h3>
            <p className="text-[#757575] text-sm mb-4">Paste your SMS to automatically detect the location.</p>

            <div className="w-full bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <textarea
                className="w-full min-h-[150px] max-h-[220px] flex-1 p-3 text-sm text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none resize-y placeholder:text-[#757575]"
                placeholder={`Paste the SMS you received...\n\nExample:\nHLB 0588: https://maps.google.com/?q=11.809477,75.481735`}
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
              />

              <div className="mt-3 min-h-[10px] flex items-center">
                {locationStatus === 'loading' && (
                  <p className="text-sm text-blue-600 flex items-center">
                    <span className="animate-spin mr-2 h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></span>
                    Detecting location...
                  </p>
                )}
                {locationStatus === 'success' && detectedLocation && (
                  <div className="text-sm text-green-700 bg-green-50 p-2 rounded-lg flex items-start w-full border border-green-100">
                    <Check size={16} className="mr-2 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Location detected</p>
                      <p className="text-green-600 text-xs mt-0.5 line-clamp-2" title={detectedLocation.displayName}>{detectedLocation.displayName}</p>
                    </div>
                  </div>
                )}
                {locationStatus === 'error' && (
                  <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 flex items-center w-full">
                    <X size={16} className="mr-2 shrink-0" />
                    {locationError}
                  </p>
                )}
              </div>

              <div className="mt-4 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className="flex items-center text-xs font-medium text-gray-500 hover:text-gray-700 transition"
                >
                  {isAdvancedOpen ? <ChevronUp size={14} className="mr-1" /> : <ChevronDown size={14} className="mr-1" />}
                  Advanced Options
                </button>

                <div className="mt-3 flex gap-2 h-[34px]">
                  {isAdvancedOpen && (
                    <>
                      <input
                        type="number"
                        placeholder="Latitude"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        className="flex-1 w-full p-2 text-xs border border-gray-300 rounded-lg outline-none placeholder:text-[#757575]"
                      />
                      <input
                        type="number"
                        placeholder="Longitude"
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                        className="flex-1 w-full p-2 text-xs border border-gray-300 rounded-lg outline-none placeholder:text-[#757575]"
                      />
                      <button
                        type="button"
                        onClick={handleManualSearch}
                        className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        title="Search Coordinates"
                      >
                        <Search size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex w-full space-x-3 mt-auto">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex-[1] py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition flex items-center justify-center"
              >
                <ArrowLeft size={18} className="mr-2" /> Back
              </button>
              <button
                onClick={handleFinishSetup}
                disabled={isSaving}
                className="flex-[2] py-3 px-4 text-white font-medium rounded-xl transition flex items-center justify-center shadow-md active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none disabled:active:scale-100"
                style={{ backgroundColor: primaryColor }}
              >
                <Check size={20} className="mr-2" />
                {isSaving ? 'Saving...' : 'Finish Setup'}
              </button>
            </div>
          </div>
        )}

        {/* Step Indicators */}
        <div className="flex items-center justify-center mt-6 w-full gap-2">
          <button
            onClick={() => setCurrentStep(1)}
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2 ${currentStep >= 1 ? 'bg-[#000] text-white border-[#000]' : 'bg-white text-gray-400 border-gray-300'}`}
          >
            1
          </button>
          <div className="w-16 h-[2px] bg-gray-200 relative overflow-hidden">
            <div className={`absolute top-0 left-0 h-full bg-[#000] transition-all duration-300 ${currentStep === 2 ? 'w-full' : 'w-0'}`} />
          </div>
          <button
            onClick={() => image && croppedData && setCurrentStep(2)}
            disabled={!image || !croppedData}
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2 ${currentStep === 2 ? 'bg-[#000] text-white border-[#000]' : 'bg-white text-gray-400 border-gray-300'}`}
          >
            2
          </button>
        </div>
      </div>
    </div>
  );
}
