/**
 * i18n Configuration
 * Multi-language support using react-i18next
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslations from '../locales/en.json';
import esTranslations from '../locales/es.json';

// Translation resources
const resources = {
  en: {
    translation: enTranslations
  },
  es: {
    translation: esTranslations
  }
};

i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,

    interpolation: {
      escapeValue: false, // React already escapes by default
    },

    detection: {
      // Order of language detection
      order: ['localStorage', 'navigator'],
      // Cache user language preference
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng'
    }
  });

export default i18n;
