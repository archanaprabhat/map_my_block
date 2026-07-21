'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, FileImage, Download } from 'lucide-react';
import ImageCompareSlider from './ImageCompareSlider';
import { useAppLanguage } from '../hooks/useAppLanguage';

export default function HomeScreen() {
  const router = useRouter();
  const { language, toggleLanguage, t } = useAppLanguage();
  const isMl = language === 'ml';

  return (
    <div className="flex min-h-dvh w-full flex-col font-sans" style={{ backgroundColor: '#faf9f5' }}>
      <header className="flex w-full shrink-0 items-center justify-between px-5 py-3 lg:px-12 lg:py-5">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <img src="/logo.png" alt="Map My Block Logo" className="h-9 w-auto shrink-0 object-contain sm:h-10" />
          <h1 className="truncate text-lg font-medium tracking-tight text-[#212121] sm:text-xl">Map My Block</h1>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-sm font-semibold text-gray-800 hover:text-black"
          >
            {t('Log in', 'ലോഗിൻ')}
          </button>
          <button
            type="button"
            onClick={toggleLanguage}
            className="rounded-full bg-black px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 sm:px-4 sm:py-2"
          >
            {language === 'en' ? 'മലയാളം' : 'English'}
          </button>
        </div>
      </header>

      <main
        className={`mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 lg:flex-row lg:items-center lg:gap-10 lg:px-12 ${
          isMl ? 'py-5 lg:py-8' : 'py-8 lg:py-14'
        }`}
      >
        {/* Left column */}
        <div
          className={`flex w-full min-w-0 flex-col items-center lg:items-start ${
            isMl ? 'lg:w-[48%] lg:pr-4' : 'lg:w-[45%] lg:pr-8'
          }`}
        >
          <h2
            className={`w-full text-center text-[#111] lg:text-left ${
              isMl
                ? 'mb-3 text-[1.65rem] leading-[1.35] tracking-tight sm:text-[1.9rem] lg:mb-4 lg:text-[2.35rem] lg:leading-[1.3]'
                : 'mb-6 text-[2.5rem] leading-[1.15] lg:text-[3.5rem] lg:leading-[1.1]'
            }`}
            style={{ fontFamily: 'Georgia, "Noto Serif Malayalam", "Noto Sans Malayalam", serif' }}
          >
            {isMl ? (
              <>
                2027-ലെ സെൻസസിനായുള്ള
                <br />
                HLB മാപ്പ് ജനറേറ്റർ
              </>
            ) : (
              <>
                HLB MAP Generator
                <br />
                for Census 2027
              </>
            )}
          </h2>

          <p
            className={`w-full text-center text-gray-700 lg:text-left ${
              isMl
                ? 'mb-5 max-w-xl text-[0.95rem] leading-relaxed sm:text-base lg:mb-6 lg:max-w-none lg:text-[1.05rem] lg:leading-[1.55]'
                : 'mb-8 text-lg leading-relaxed lg:max-w-[85%] lg:text-xl'
            }`}
          >
            {isMl ? (
              <>
                MapMyBlock ഉപയോഗിച്ച് HLB മാപ്പുകൾ A4 വലുപ്പത്തിൽ എളുപ്പത്തിൽ സൃഷ്ടിക്കാം. ഇനി ഒരിക്കലും
                കഷ്ടപ്പെട്ട് കൈകൊണ്ട് മാപ്പ് വരയ്ക്കേണ്ടതില്ല.
              </>
            ) : (
              <>MapMyBlock generates HLB map A4 size. You&apos;ll never need to &quot;draw manually&quot; again.</>
            )}
          </p>

          <button
            type="button"
            onClick={() => router.push('/upload')}
            className={`flex items-center justify-center gap-2 rounded-full bg-black font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-95 ${
              isMl
                ? 'mb-6 px-7 py-3 text-sm lg:mb-7 lg:px-9'
                : 'mb-12 px-8 py-4 text-sm lg:px-10 lg:text-base'
            }`}
          >
            {t('Get started for free', 'തുടങ്ങാം')}
          </button>

          <div
            className={`flex w-full flex-col text-gray-800 ${
              isMl ? 'gap-3.5 text-[0.8rem] leading-snug sm:text-[0.875rem] lg:gap-4' : 'gap-6 text-sm lg:text-base'
            }`}
          >
            <div className="flex items-start gap-3">
              <ClipboardList size={isMl ? 18 : 22} className="mt-0.5 shrink-0 stroke-[1.5] text-gray-700" />
              <span className="min-w-0 flex-1 text-left font-medium">
                {t(
                  'Copy paste your SMS and get your places',
                  'നിങ്ങൾക്ക് ലഭിച്ച SMS ഒട്ടിക്കുക — സ്ഥലങ്ങൾ സ്വയമേവ പ്രദർശിപ്പിക്കും.'
                )}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <FileImage size={isMl ? 18 : 22} className="mt-0.5 shrink-0 stroke-[1.5] text-gray-700" />
              <span className="min-w-0 flex-1 text-left font-medium">
                {t(
                  'Upload images or PDF and get them in handwritten format',
                  'ചിത്രം അല്ലെങ്കിൽ PDF അപ്‌ലോഡ് ചെയ്യുക — കൈകൊണ്ട് വരച്ചതുപോലുള്ള ഫോർമാറ്റിൽ HLB മാപ്പ് ലഭിക്കും.'
                )}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <Download size={isMl ? 18 : 22} className="mt-0.5 shrink-0 stroke-[1.5] text-gray-700" />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left font-medium">
                <span>{t('Download A4 size', 'A4 വലുപ്പത്തിൽ ഡൗൺലോഡ് ചെയ്യുക.')}</span>
                <div className="flex h-5 items-center justify-center rounded-[3px] border border-red-500 px-1 text-[9px] font-bold text-red-500">
                  PDF
                </div>
                <span className="text-base leading-none">🇮🇳</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div
          className={`flex w-full shrink-0 items-center justify-center lg:justify-end ${
            isMl ? 'mt-8 lg:mt-0 lg:w-[52%]' : 'mt-16 lg:mt-0 lg:w-[50%]'
          }`}
        >
          <div className={`w-full ${isMl ? 'max-w-[460px]' : 'max-w-[500px]'}`}>
            <ImageCompareSlider
              beforeSrc="/demo-map-before.avif"
              afterSrc="/demo-map-after.avif"
              beforeAlt="Digital map view"
              afterAlt="Hand-drawn HLB style map"
              initial={55}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
