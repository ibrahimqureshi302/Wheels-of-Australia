import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  // Load translation using http -> see /public/locales
  .use(Backend)
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // Initialize i18next
  .init({
    fallbackLng: 'en',
    defaultNS: 'common',
    
    // Debug mode - set to false in production
    debug: import.meta.env.DEV,

    interpolation: {
      escapeValue: false, // Not needed for react as it escapes by default
    },

    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    // Backend options for loading translations from public folder
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    // Supported languages
    supportedLngs: ['en'],
    
    // Namespace configuration
    ns: ['common'],
  });

export default i18n;
