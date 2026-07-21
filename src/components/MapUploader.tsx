'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Cropper, { ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { UploadCloud, Check, X, Search, ChevronDown, ChevronUp, ArrowRight, ArrowLeft } from 'lucide-react';
import { extractCoordinates, reverseGeocode } from '../lib/location';
import { DetectedLocation } from '../lib/storage';
import { useAppLanguage } from '../hooks/useAppLanguage';

const primaryColor = '#212121';
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
  title,
  description,
}: MapUploaderProps) {
  const { language, toggleLanguage, t } = useAppLanguage();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [croppedData, setCroppedData] = useState<{ image: string; aspectRatio: number } | null>(null);

  const [image, setImage] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(draftImageKey);
  });
  const [isCropperReady, setIsCropperReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [smsText, setSmsText] = useState('');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualQ, setManualQ] = useState('');

  const cropperRef = useRef<ReactCropperElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pageTitle =
    title ?? t('Upload Layout Map', 'ലേഔട്ട് മാപ്പ് അപ്‌ലോഡ് ചെയ്യുക');
  const pageDescription =
    description ??
    t(
      'Upload the government-issued Houselisting Block (HLB) layout map to use as a reference.',
      'സർക്കാർ നൽകിയ ഹൗസ് ലിസ്റ്റിംഗ് ബ്ലോക്ക് (HLB) ലേഔട്ട് മാപ്പ് റഫറൻസായി ഉപയോഗിക്കുന്നതിനായി അപ്‌ലോഡ് ചെയ്യുക.'
    );

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
      setLocationError(
        t(
          "Couldn't detect coordinates or location from the pasted text.",
          'ഒട്ടിച്ച വാചകത്തിൽ നിന്ന് ലൊക്കേഷൻ കണ്ടെത്താനായില്ല.'
        )
      );
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
        void processLocationLookup(coords.lat, coords.lng);
      } else {
        setDetectedLocation(null);
        setLocationError(
          t(
            "Couldn't detect coordinates from the pasted text.",
            'ഒട്ടിച്ച വാചകത്തിൽ നിന്ന് കോർഡിനേറ്റുകൾ കണ്ടെത്താനായില്ല.'
          )
        );
        setLocationStatus('error');
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on smsText; language only affects error copy
  }, [smsText]);

  const handleManualSearch = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      void processLocationLookup(lat, lng);
    } else {
      setLocationError(t('Invalid latitude or longitude.', 'അസാധുവായ അക്ഷാംശം അല്ലെങ്കിൽ രേഖാംശം.'));
      setLocationStatus('error');
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setErrorMessage(null);
      if (file.size > maxUploadBytes) {
        setErrorMessage(
          t('Image is larger than 10MB. Please choose a smaller file.', 'ചിത്രം 10 MB-യിൽ കൂടുതലാണ്. ചെറിയ ഫയൽ തിരഞ്ഞെടുക്കുക.')
        );
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
        setErrorMessage(t('Could not read this image. Please try another file.', 'ഈ ചിത്രം വായിക്കാനായില്ല. മറ്റൊരു ഫയൽ ശ്രമിക്കുക.'));
      };
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxSize: maxUploadBytes,
    multiple: false,
    onDropRejected: () =>
      setErrorMessage(t('Only image files up to 10MB can be uploaded.', '10 MB വരെയുള്ള ചിത്ര ഫയലുകൾ മാത്രമേ അപ്‌ലോഡ് ചെയ്യാവൂ.')),
  });

  const handleNextStep = () => {
    const cropper = cropperRef.current?.cropper;
    const croppedCanvas = cropper?.getCroppedCanvas({
      maxWidth: 2048,
      maxHeight: 2048,
    });

    if (!croppedCanvas) {
      setErrorMessage(t('Cropper is not ready yet. Please retry in a moment.', 'ക്രോപ്പർ തയ്യാറല്ല. അൽപസമയം കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.'));
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
      setErrorMessage(t('Could not save the setup. Please retry.', 'സജ്ജീകരണം സേവ് ചെയ്യാനായില്ല. വീണ്ടും ശ്രമിക്കുക.'));
    } finally {
      setIsSaving(false);
    }
  };

  const langToggle = (
    <button
      type="button"
      onClick={toggleLanguage}
      className="rounded-full bg-black px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-gray-800"
    >
      {language === 'en' ? 'മലയാളം' : 'English'}
    </button>
  );

  return (
    <div
      className="relative flex h-screen w-full flex-col items-center justify-center bg-cover bg-center p-4"
      style={{ backgroundImage: 'url(/cover.webp)' }}
    >
      <div className="absolute inset-0 z-0 bg-black/10" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">{langToggle}</div>

      <div className="relative z-10 flex min-h-[520px] w-full max-w-[440px] flex-col items-stretch rounded-2xl bg-white p-6 shadow-xl transition-all duration-300">
        <div className="mb-2 flex w-full items-start justify-between gap-3">
          <h2 className="flex-1 text-center text-2xl font-bold text-gray-800">{pageTitle}</h2>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
              title={t('Cancel', 'റദ്ദാക്കുക')}
              aria-label={t('Cancel', 'റദ്ദാക്കുക')}
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

        {currentStep === 1 && (
          <div className="flex w-full flex-1 animate-in fade-in zoom-in-95 flex-col duration-300">
            <h3 className="mb-1 text-lg font-semibold text-gray-800">
              {t('Layout Map', 'ലേഔട്ട് മാപ്പ്')}
            </h3>
            <p className="mb-4 text-sm text-gray-500">{pageDescription}</p>

            {!image ? (
              <>
                <div
                  {...getRootProps()}
                  className={`flex h-[280px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
                    isDragActive ? 'bg-gray-100' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                  style={isDragActive ? { borderColor: primaryColor } : undefined}
                >
                  <input {...getInputProps()} />
                  <UploadCloud size={48} className="mb-4 text-gray-400" />
                  <p className="text-center font-medium text-gray-600">
                    {isDragActive
                      ? t('Drop image here...', 'ചിത്രം ഇവിടെ വിടുക...')
                      : t('Tap to upload or drag and drop', 'ടാപ്പ് ചെയ്ത് അപ്‌ലോഡ് ചെയ്യുക അല്ലെങ്കിൽ ഫയൽ ഇവിടെ വലിച്ചിടുക')}
                  </p>
                  <p className="mt-2 text-center text-xs text-gray-400">
                    {t('PNG, JPG up to 10MB', 'PNG, JPG ഫയലുകൾ (പരമാവധി 10 MB)')}
                  </p>
                </div>
                <div className="mt-auto flex h-[48px] w-full space-x-3" />
              </>
            ) : (
              <div className="flex w-full flex-1 flex-col items-center">
                <div className="mb-4 h-[280px] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
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

                <div className="mt-auto flex w-full space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setImage(null);
                      setIsCropperReady(false);
                      setErrorMessage(null);
                      window.sessionStorage.removeItem(draftImageKey);
                    }}
                    className="flex-1 rounded-xl bg-gray-100 px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-200"
                  >
                    {t('Cancel', 'റദ്ദാക്കുക')}
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={!isCropperReady}
                    className="flex flex-1 items-center justify-center rounded-xl px-4 py-3 font-medium text-white shadow-md transition active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none disabled:active:scale-100"
                    style={isCropperReady ? { backgroundColor: primaryColor } : undefined}
                  >
                    {t('Next', 'അടുത്തത്')} <ArrowRight size={18} className="ml-2" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="flex w-full flex-1 animate-in fade-in zoom-in-95 flex-col duration-300">
            <h3 className="mb-1 text-lg font-semibold text-gray-800">
              {t('Detect Location', 'ലൊക്കേഷൻ കണ്ടെത്തുക')}
            </h3>
            <p className="mb-4 text-sm text-[#757575]">
              {t(
                'Paste your SMS to automatically detect the location.',
                'ലൊക്കേഷൻ സ്വയമേവ കണ്ടെത്തുന്നതിനായി നിങ്ങൾക്ക് ലഭിച്ച SMS ഒട്ടിക്കുക.'
              )}
            </p>

            <div className="mb-5 w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <textarea
                className="min-h-[150px] max-h-[220px] w-full flex-1 resize-y rounded-lg border border-gray-300 p-3 text-sm text-black outline-none placeholder:text-[#757575] focus:border-black focus:ring-2 focus:ring-black"
                placeholder={
                  language === 'ml'
                    ? 'നിങ്ങൾക്ക് ലഭിച്ച SMS ഇവിടെ ഒട്ടിക്കുക...\n\nഉദാഹരണം:\nHLB 0588: https://maps.google.com/?q=11.809477,75.481735'
                    : 'Paste the SMS you received...\n\nExample:\nHLB 0588: https://maps.google.com/?q=11.809477,75.481735'
                }
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
              />

              <div className="mt-3 flex min-h-[10px] items-center">
                {locationStatus === 'loading' && (
                  <p className="flex items-center text-sm text-blue-600">
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    {t('Detecting location...', 'ലൊക്കേഷൻ കണ്ടെത്തുന്നു...')}
                  </p>
                )}
                {locationStatus === 'success' && detectedLocation && (
                  <div className="flex w-full items-start rounded-lg border border-green-100 bg-green-50 p-2 text-sm text-green-700">
                    <Check size={16} className="mr-2 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">{t('Location detected', 'ലൊക്കേഷൻ കണ്ടെത്തി')}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-green-600" title={detectedLocation.displayName}>
                        {detectedLocation.displayName}
                      </p>
                    </div>
                  </div>
                )}
                {locationStatus === 'error' && (
                  <p className="flex w-full items-center rounded-lg border border-red-100 bg-red-50 p-2 text-sm text-red-600">
                    <X size={16} className="mr-2 shrink-0" />
                    {locationError}
                  </p>
                )}
              </div>

              <div className="mt-4 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className="flex items-center text-xs font-medium text-gray-500 transition hover:text-gray-700"
                >
                  {isAdvancedOpen ? <ChevronUp size={14} className="mr-1" /> : <ChevronDown size={14} className="mr-1" />}
                  {t('Advanced Options', 'കൂടുതൽ ഓപ്ഷനുകൾ')}
                </button>

                {isAdvancedOpen && (
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={t('Latitude', 'അക്ഷാംശം')}
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        className="w-full flex-1 rounded-lg border border-gray-300 p-2 text-xs outline-none placeholder:text-[#757575]"
                      />
                      <input
                        type="number"
                        placeholder={t('Longitude', 'രേഖാംശം')}
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                        className="w-full flex-1 rounded-lg border border-gray-300 p-2 text-xs outline-none placeholder:text-[#757575]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={t('Q value', 'Q മൂല്യം')}
                        value={manualQ}
                        onChange={(e) => setManualQ(e.target.value)}
                        className="w-full flex-1 rounded-lg border border-gray-300 p-2 text-xs outline-none placeholder:text-[#757575]"
                      />
                      <button
                        type="button"
                        onClick={handleManualSearch}
                        className="rounded-lg bg-gray-100 p-2 text-gray-700 hover:bg-gray-200"
                        title={t('Search Coordinates', 'കോർഡിനേറ്റുകൾ തിരയുക')}
                      >
                        <Search size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-auto flex w-full space-x-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex flex-[1] items-center justify-center rounded-xl bg-gray-100 px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-200"
              >
                <ArrowLeft size={18} className="mr-2" /> {t('Back', 'തിരികെ')}
              </button>
              <button
                type="button"
                onClick={() => void handleFinishSetup()}
                disabled={isSaving}
                className="flex flex-[2] items-center justify-center rounded-xl px-4 py-3 font-medium text-white shadow-md transition active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none disabled:active:scale-100"
                style={{ backgroundColor: primaryColor }}
              >
                <Check size={20} className="mr-2" />
                {isSaving
                  ? t('Saving...', 'സേവ് ചെയ്യുന്നു...')
                  : t('Finish Setup', 'സജ്ജീകരണം പൂർത്തിയാക്കുക')}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex w-full items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
              currentStep >= 1 ? 'border-[#000] bg-[#000] text-white' : 'border-gray-300 bg-white text-gray-400'
            }`}
          >
            1
          </button>
          <div className="relative h-[2px] w-16 overflow-hidden bg-gray-200">
            <div
              className={`absolute left-0 top-0 h-full bg-[#000] transition-all duration-300 ${
                currentStep === 2 ? 'w-full' : 'w-0'
              }`}
            />
          </div>
          <button
            type="button"
            onClick={() => image && croppedData && setCurrentStep(2)}
            disabled={!image || !croppedData}
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
              currentStep === 2 ? 'border-[#000] bg-[#000] text-white' : 'border-gray-300 bg-white text-gray-400'
            }`}
          >
            2
          </button>
        </div>
      </div>
    </div>
  );
}
