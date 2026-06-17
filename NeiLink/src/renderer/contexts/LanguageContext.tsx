import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { getLocale, Locale } from '../../shared/i18n';
import { useSettings } from './SettingsContext';

interface LanguageContextType {
  locale: Locale;
  language: string;
  setLanguage: (language: string) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings, updateSetting } = useSettings();

  // 语言直接来自全局设置（设置在应用启动时已加载）
  const language = settings.language || 'zh-CN';
  const locale = useMemo(() => getLocale(language), [language]);

  const setLanguage = (newLanguage: string) => {
    updateSetting('language', newLanguage);
  };

  return (
    <LanguageContext.Provider value={{ locale, language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
