'use client';

import { createTranslator, isLocale, resolveLocale, langOptions } from '@vocespace/i18n';
import type { Trans } from '@vocespace/i18n';
export type { Trans, Translations } from '@vocespace/i18n';
export { langOptions };
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

// 创建 i18n 上下文
interface I18nContextType {
  locale: string;
  t: Trans;
  changeLocale: (newLocale: string) => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: string;
}

export function I18nProvider({ children, initialLocale = 'en' }: I18nProviderProps) {
  const [locale, setLocale] = useState(() => {
    return resolveLocale(initialLocale);
  });

  // 从 URL 或浏览器语言获取初始语言
  useEffect(() => {
    // 首先尝试从localStorage中获取语言
    if (typeof window !== 'undefined') {
      const storedLocale = localStorage.getItem('locale');
      if (isLocale(storedLocale)) {
        setLocale(storedLocale);
        return;
      }
    }

    // 如果没有存储的语言，尝试从浏览器语言获取
    const browserLocale = navigator.language.split('-')[0];
    if (isLocale(browserLocale)) {
      setLocale(browserLocale);
    } else {
      setLocale(resolveLocale(initialLocale));
    }
  }, []);

  const t = useMemo(() => createTranslator(locale), [locale]);

  // 切换语言
  const changeLocale = (newLocale: string) => {
    if (isLocale(newLocale)) {
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
