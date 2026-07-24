// Translation utility functions

export const getLanguageFromNavigator = (): string => {
  if (typeof navigator !== 'undefined') {
    return navigator.language.split('-')[0];
  }
  return 'en';
};

export const getSupportedLanguage = (lang: string): string => {
  const supportedLanguages = ['en']; // Add more languages here
  return supportedLanguages.includes(lang) ? lang : 'en';
};

export const formatTranslationKey = (namespace: string, key: string): string => {
  return `${namespace}.${key}`;
};

// Date formatting with localization support
export const formatLocalizedDate = (date: string | Date, locale: string = 'en'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj);
};

export const formatLocalizedDateTime = (date: string | Date, locale: string = 'en'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
};
