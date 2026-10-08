import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import ta from './ta.json';
import hi from './hi.json';
import ml from './ml.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ta: { translation: ta },
      hi: { translation: hi },
      ml: { translation: ml },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ta', 'hi', 'ml'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'nexora_language',
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
