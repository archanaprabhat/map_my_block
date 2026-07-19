'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  APP_LANGUAGE_KEY,
  AppLanguage,
  readAppLanguage,
  writeAppLanguage,
} from '../lib/i18n/language';

/** Shared en/ml preference for home + upload (and any other screens). */
export function useAppLanguage() {
  const [language, setLanguageState] = useState<AppLanguage>('en');

  useEffect(() => {
    setLanguageState(readAppLanguage());

    const onStorage = (event: StorageEvent) => {
      if (event.key === APP_LANGUAGE_KEY) {
        setLanguageState(event.newValue === 'ml' ? 'ml' : 'en');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setLanguage = useCallback((lang: AppLanguage) => {
    writeAppLanguage(lang);
    setLanguageState(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'ml' : 'en');
  }, [language, setLanguage]);

  const t = useCallback(
    (en: string, ml: string) => (language === 'ml' ? ml : en),
    [language]
  );

  return { language, setLanguage, toggleLanguage, t };
}
