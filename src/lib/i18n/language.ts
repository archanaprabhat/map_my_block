export type AppLanguage = 'en' | 'ml';

export const APP_LANGUAGE_KEY = 'map-my-block-lang';

export const readAppLanguage = (): AppLanguage => {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(APP_LANGUAGE_KEY) === 'ml' ? 'ml' : 'en';
};

export const writeAppLanguage = (lang: AppLanguage) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(APP_LANGUAGE_KEY, lang);
};
