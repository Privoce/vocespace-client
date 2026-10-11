import en from './en_US';
import zh from './zh_CN';
import ru from './ru_RU';

/** Canonical Web/App dictionaries. Persistence and system-language detection belong to adapters. */
export const translations = { en, zh, ru };
export type Locale = keyof typeof translations;
export type Translations = typeof en;
export type Trans = (key: string, options?: Record<string, string | number>) => string;
export const langOptions = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '简体中文' },
  { value: 'ru', label: 'Русский' },
];
export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'zh' || value === 'ru';
}
export function resolveLocale(value: unknown, fallback: Locale = 'en'): Locale {
  if (typeof value !== 'string') return fallback;
  const language = value.toLowerCase().split(/[-_]/)[0];
  return isLocale(language) ? language : fallback;
}
function lookup(tree: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (value, part) =>
        value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, part)
          ? (value as Record<string, unknown>)[part]
          : undefined,
      tree,
    );
}
export function createTranslator(locale: Locale): Trans {
  return (key, options) => {
    const value = lookup(translations[locale], key) ?? lookup(en, key);
    if (typeof value !== 'string') return key;
    if (!options) return value;
    return value.replace(/\{\{?(\w+)\}?\}/g, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(options, name) ? String(options[name]) : match,
    );
  };
}
