import { useTranslation } from 'react-i18next';

// Custom hook for easier translation usage
export const useTranslate = () => {
  const { t, i18n } = useTranslation();
  
  return {
    t,
    i18n,
    currentLanguage: i18n.language,
    changeLanguage: (lng: string) => i18n.changeLanguage(lng),
    isLoading: i18n.isInitialized === false,
  };
};

export default useTranslate;
