'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Database,
  Fingerprint,
  HardDrive,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAppLanguage } from '../../hooks/useAppLanguage';

export default function LoginPage() {
  const router = useRouter();
  const { language, toggleLanguage, t } = useAppLanguage();
  const isMl = language === 'ml';

  return (
    <div className="flex min-h-dvh w-full flex-col font-sans" style={{ backgroundColor: '#faf9f5' }}>
      <header className="flex w-full shrink-0 items-center justify-between px-5 py-3 lg:px-12 lg:py-5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <img src="/logo.png" alt="Map My Block Logo" className="h-9 w-auto shrink-0 object-contain sm:h-10" />
          <span className="truncate text-lg font-medium tracking-tight text-[#212121] sm:text-xl">Map My Block</span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={toggleLanguage}
            className="rounded-full bg-black px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 sm:px-4 sm:py-2"
          >
            {language === 'en' ? 'മലയാളം' : 'English'}
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-12 pt-4 lg:px-8 lg:pt-8">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-600 transition hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          {t('Back to home', 'ഹോമിലേക്ക് മടങ്ങുക')}
        </button>

        <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          <Fingerprint size={14} />
          {t('Works in Incognito — no account needed', 'ഇൻകോഗ്നിറ്റോയിൽ പ്രവർത്തിക്കും — അക്കൗണ്ട് വേണ്ട')}
        </div>

        <h1
          className={`mb-3 font-medium text-[#111] ${isMl ? 'text-2xl leading-snug sm:text-3xl' : 'text-3xl leading-tight sm:text-4xl'
            }`}
          style={{ fontFamily: 'Georgia, "Noto Serif Malayalam", serif' }}
        >
          {t('Login is intentionally paused', 'ലോഗിൻ ഇപ്പോൾ നിർത്തിവെച്ചിരിക്കുന്നു')}
        </h1>

        <p className={`mb-8 max-w-2xl text-gray-700 ${isMl ? 'text-[0.95rem] leading-relaxed' : 'text-base leading-relaxed sm:text-lg'}`}>
          {t(
            'For this hackathon, Map My Block has no sign-in. Judges (and anyone) can open the app in a private/incognito window and map a block without sharing email, phone, or Google credentials. That is a deliberate choice — not a missing feature.',
            'ഈ ഹാക്കത്തോണിനായി Map My Block-ൽ സൈൻ-ഇൻ ഇല്ല. ജഡ്ജുമാർക്ക് (ആർക്കും) പ്രൈവറ്റ്/ഇൻകോഗ്നിറ്റോ വിൻഡോയിൽ ആപ്പ് തുറന്ന് ഇമെയിൽ, ഫോൺ, അല്ലെങ്കിൽ Google അക്കൗണ്ട് നൽകാതെ ബ്ലോക്ക് മാപ്പ് ചെയ്യാം. ഇത് ബോധപൂർവമായ തീരുമാനമാണ് — വിട്ടുപോയ ഫീച്ചറല്ല.'
          )}
        </p>

        {/* Primary CTA */}
        <div className="mb-8 rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#212121]">
            <Sparkles size={16} />
            {t('Start mapping now', 'ഇപ്പോൾ മാപ്പിംഗ് തുടങ്ങുക')}
          </div>
          <p className="mb-4 text-sm leading-relaxed text-gray-600">
            {t(
              'No signup. No forms. Your layout, boundary, tags, and HLB export stay on this device until you download them.',
              'സൈൻഅപ്പ് ഇല്ല. ഫോമുകൾ ഇല്ല. ലേഔട്ട്, അതിർത്തി, ടാഗുകൾ, HLB എക്സ്‌പോർട്ട് — ഡൗൺലോഡ് ചെയ്യുന്നത് വരെ ഈ ഉപകരണത്തിൽ തന്നെ.'
            )}
          </p>
          <button
            type="button"
            onClick={() => router.push('/upload')}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition hover:bg-gray-800 active:scale-[0.98]"
          >
            {t('Continue without login', 'ലോഗിൻ ഇല്ലാതെ തുടരുക')}
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Why / architecture */}
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-black/8 bg-white/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#212121]">
              <HardDrive size={16} />
              {t('Frontend-only today', 'ഇപ്പോൾ പൂർണ്ണമായും ഫ്രണ്ട്എൻഡ്')}
            </div>
            <p className="text-xs leading-relaxed text-gray-600 sm:text-sm">
              {t(
                'All project data lives in IndexedDB / local storage on the phone or laptop. There is no backend collecting enumerator or judge data right now.',
                'എല്ലാ പ്രോജക്ട് ഡാറ്റയും ഫോൺ/ലാപ്‌ടോപ്പിലെ IndexedDB / ലോക്കൽ സ്റ്റോറേജിലാണ്. ഇപ്പോൾ ജഡ്ജ് അല്ലെങ്കിൽ എന്യൂമറേറ്റർ ഡാറ്റ ശേഖരിക്കുന്ന ബാക്കെൻഡ് ഇല്ല.'
              )}
            </p>
          </div>
          <div className="rounded-xl border border-black/8 bg-white/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#212121]">
              <ShieldCheck size={16} />
              {t('Privacy by design', 'സ്വകാര്യത ആദ്യം')}
            </div>
            <p className="text-xs leading-relaxed text-gray-600 sm:text-sm">
              {t(
                'Hackathon rules ask for demos that work without forcing personal info. So built for that: open → map → export. Zero friction for reviewers.',
                'ഹാക്കത്തോൺ നിയമങ്ങൾ വ്യക്തിഗത വിവരങ്ങൾ നിർബന്ധമാക്കാത്ത ഡെമോകൾ ആവശ്യപ്പെടുന്നു. അതിനായി നിർമ്മിച്ചു: തുറക്കുക → മാപ്പ് ചെയ്യുക → എക്സ്‌പോർട്ട്. റിവ്യൂവർമാർക്ക് പൂജ്യം തടസ്സം.'
              )}
            </p>
          </div>
        </div>

        {/* Coming soon — Google + Supabase */}
        <section className="mb-8 rounded-2xl border border-dashed border-gray-300 bg-[#f3f1eb] p-5 sm:p-6">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">
            {t('Public release roadmap', 'പബ്ലിക് റിലീസ് റോഡ്‌മാപ്പ്')}
          </div>
          <h2
            className={`mb-3 text-[#111] ${isMl ? 'text-lg leading-snug' : 'text-xl'}`}
            style={{ fontFamily: 'Georgia, "Noto Serif Malayalam", serif' }}
          >
            {t('Login is coming — for real enumerators', 'ലോഗിൻ വരുന്നു — യഥാർത്ഥ എന്യൂമറേറ്റർമാർക്ക്')}
          </h2>
          <p className="mb-5 text-sm leading-relaxed text-gray-700">
            {t(
              'When Map My Block ships for Census field use, authenticating will matter for syncing blocks across devices and supervisor review. Planned stack:',
              'Census ഫീൽഡ് ഉപയോഗത്തിനായി Map My Block റിലീസ് ചെയ്യുമ്പോൾ, ഉപകരണങ്ങൾക്കിടയിൽ ബ്ലോക്ക് സിങ്ക് ചെയ്യാനും സൂപ്പർവൈസർ റിവ്യൂവിനും ഓതന്റിക്കേഷൻ ആവശ്യമാകും. ആസൂത്രിത സ്റ്റാക്ക്:'
            )}
          </p>

          <ul className="mb-5 space-y-3">
            <li className="flex gap-3 text-sm text-gray-800">
              <Lock size={16} className="mt-0.5 shrink-0 text-gray-600" />
              <span>
                <strong className="font-semibold">{t('Google Sign-In', 'Google സൈൻ-ഇൻ')}</strong>
                {' — '}
                {t(
                  'one-tap login for enumerators; no new passwords to remember in the field.',
                  'എന്യൂമറേറ്റർമാർക്ക് വൺ-ടാപ്പ് ലോഗിൻ; ഫീൽഡിൽ പുതിയ പാസ്‌വേഡ് ഓർക്കേണ്ട.'
                )}
              </span>
            </li>
            <li className="flex gap-3 text-sm text-gray-800">
              <Database size={16} className="mt-0.5 shrink-0 text-gray-600" />
              <span>
                <strong className="font-semibold">Supabase</strong>
                {' — '}
                {t(
                  'secure backend for auth, project sync, and optional supervisor dashboards — while keeping a local-first offline mode.',
                  'ഓത്ത്, പ്രോജക്ട് സിങ്ക്, സൂപ്പർവൈസർ ഡാഷ്‌ബോർഡുകൾക്കുള്ള സുരക്ഷിത ബാക്കെൻഡ് — ലോക്കൽ-ഫസ്റ്റ് ഓഫ്‌ലൈൻ മോഡ് നിലനിർത്തി.'
                )}
              </span>
            </li>
          </ul>

          {/* Disabled Google button — shows ambition without collecting data */}
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-400 opacity-80 sm:w-auto sm:min-w-[280px]"
            title={t('Available after public release', 'പബ്ലിക് റിലീസിന് ശേഷം ലഭ്യമാകും')}
          >
            <GoogleGlyph />
            {t('Continue with Google — coming soon', 'Google ഉപയോഗിച്ച് തുടരുക — ഉടൻ')}
          </button>
          <p className="mt-2 text-xs text-gray-500">
            {t(
              'Disabled on purpose for the hackathon so reviewers never have to share an account.',
              'ഹാക്കത്തോണിൽ റിവ്യൂവർമാർ അക്കൗണ്ട് നൽകേണ്ടാതാക്കാൻ ബോധപൂർവം ഡിസേബിൾ ചെയ്തിരിക്കുന്നു.'
            )}
          </p>
        </section>

        {/* Hackathon edge line */}
        <p className="border-t border-black/5 pt-6 text-center text-xs leading-relaxed text-gray-500 sm:text-sm">
          {t(
            'Judge tip: open this app in Incognito, upload a layout, confirm a boundary, fetch buildings, and export an HLB — end to end, with zero personal data.',
            'ജഡ്ജ് ടിപ്പ്: ഇൻകോഗ്നിറ്റോയിൽ ആപ്പ് തുറക്കുക, ലേഔട്ട് അപ്‌ലോഡ് ചെയ്യുക, അതിർത്തി സ്ഥിരീകരിക്കുക, കെട്ടിടങ്ങൾ ഫെച്ച് ചെയ്യുക, HLB എക്സ്‌പോർട്ട് ചെയ്യുക — വ്യക്തിഗത ഡാറ്റയില്ലാതെ പൂർണ്ണ ഫ്ലോ.'
          )}
        </p>
      </main>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.1 4 9.2 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.1 39.6 15.9 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.5-6.1 7l.1.1 6.2 5.2C37.3 41.4 44 36 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
