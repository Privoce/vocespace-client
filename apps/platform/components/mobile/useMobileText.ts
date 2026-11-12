import zh from '@vocespace/i18n/zh_CN';
import en from '@vocespace/i18n/en_US';
import { useI18n } from '@/lib/i18n/i18n';
export function useMobileText() {
  const { locale } = useI18n();
  return (key: string): string => {
    let value: unknown = locale === 'zh' ? zh : en;
    for (const part of key.split('.'))
      value =
        value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
    return typeof value === 'string' ? value : key;
  };
}
