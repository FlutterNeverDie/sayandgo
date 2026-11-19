import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ko from './locales/ko.json';

export const LANGUAGES = [
  { code: 'ko', name: '한국어' },
  { code: 'en', name: 'English' },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ko: { translation: ko }, en: { translation: en } },
    fallbackLng: 'en',
    supportedLngs: LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true, // ko-KR → ko
    load: 'languageOnly',
    // 국가보다 브라우저 언어 우선. 직접 고른 언어는 기억한다.
    detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: 'sayandgo:lang', caches: ['localStorage'] },
    interpolation: { escapeValue: false },
    returnObjects: true,
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.resolvedLanguage ?? 'en';

export function currentLang(): string {
  return i18n.resolvedLanguage ?? 'en';
}

export default i18n;
