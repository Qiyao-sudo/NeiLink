import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { getLocale, Locale } from '../../shared/i18n';
import { SystemSettings } from '../../shared/types';

interface LanguageContextType {
  locale: Locale;
  language: string;
  setLanguage: (language: string) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
  initialSettings: SystemSettings;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children, initialSettings }) => {
  const [language, setLanguageState] = useState<string>(initialSettings.language);
  const [locale, setLocale] = useState<Locale>(getLocale(initialSettings.language));
  const userChangedRef = useRef(false);

  // 当 initialSettings 变化时更新语言设置（仅限非用户主动切换的情况）
  useEffect(() => {
    if (userChangedRef.current) {
      userChangedRef.current = false;
      return;
    }
    if (initialSettings.language && initialSettings.language !== language) {
      setLanguageState(initialSettings.language);
      setLocale(getLocale(initialSettings.language));
    }
  }, [initialSettings.language]);

  const setLanguage = async (newLanguage: string) => {
    userChangedRef.current = true;
    setLanguageState(newLanguage);
    setLocale(getLocale(newLanguage));
    
    // 保存语言设置到系统设置
    try {
      await window.neilink.ipc.invoke('settings:save', { language: newLanguage });
    } catch (error) {
      console.error('保存语言设置失败:', error);
    }
  };

  return (
    <LanguageContext.Provider value={{ locale, language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
