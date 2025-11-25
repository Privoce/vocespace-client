'use client';

import { PARTICIPANT_SETTINGS_KEY, ParticipantSettings } from '../std/space';
import en from './en_US';
import zh from './zh_CN';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

// 定义翻译类型
export type Translations = typeof en;
export type Trans = (key: string, options?: { [key: string]: string | number }) => string;
// 创建 i18n 上下文
interface I18nContextType {
  locale: string;
  t: Trans;
  changeLocale: (newLocale: string) => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// 所有翻译
const translations = {
  en,
  zh,
};

interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: string;
}

export function I18nProvider({ children, initialLocale = 'en' }: I18nProviderProps) {
  const [locale, setLocale] = useState(() => {
    return initialLocale;
  });

  // 从 URL 或浏览器语言获取初始语言
  useEffect(() => {
    // 首先尝试从localStorage中获取语言
    if (typeof window !== 'undefined') {
      const storedLocale = localStorage.getItem('locale');
      if (storedLocale) {
        setLocale(storedLocale);
        return;
      }
    }

    // 如果没有存储的语言，尝试从浏览器语言获取
    const browserLocale = navigator.language.split('-')[0];
    if (Object.keys(translations).includes(browserLocale)) {
      setLocale(browserLocale);
    } else {
      setLocale(initialLocale);
    }
  }, []);

  // 翻译函数, 通过 key 获取翻译
  // #allow(warning): `acc[cur as keyof typeof acc]` is safe because `cur` is a key of `acc`
  const t = (key: string): string => {
    return (
      key.split('.').reduce((acc, cur) => {
        return acc && acc[cur as keyof typeof acc];
      }, translations[locale as keyof typeof translations] as any) || key
    );
  };

  // 切换语言
  const changeLocale = (newLocale: string) => {
    if (Object.keys(translations).includes(newLocale)) {
      // 保存到localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('locale', newLocale);
      }

      setLocale(newLocale);
    }
  };

  return (
    <I18nContext.Provider value={{ locale, t, changeLocale }}>{children}</I18nContext.Provider>
  );
}

// 创建自定义钩子
export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export const langOptions = [
  {
    value: 'en',
    label: 'English',
  },
  {
    value: 'zh',
    label: '简体中文',
  },
];
