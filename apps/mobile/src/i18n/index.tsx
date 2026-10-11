import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createTranslator,
  isLocale,
  resolveLocale,
  type Locale,
  type Trans,
} from '@vocespace/i18n';
const key = 'vocespace.locale.v1';
const Context = createContext<
  { locale: Locale; t: Trans; changeLocale: (locale: string) => void; error?: string } | undefined
>(undefined);
export function NativeI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() =>
    resolveLocale(Intl.DateTimeFormat().resolvedOptions().locale, 'zh'),
  );
  const [error, setError] = useState<string>();
  const revision = useRef(0);
  const writes = useRef(Promise.resolve());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const version = revision.current;
    let active = true;
    void AsyncStorage.getItem(key)
      .then((saved) => {
        if (active && revision.current === version && isLocale(saved)) setLocale(saved);
      })
      .catch(() => {
        if (active) setError('native_settings.storage_error');
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);
  const changeLocale = useCallback((next: string) => {
    if (!isLocale(next)) return;
    const version = ++revision.current;
    setLocale(next);
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(key, next))
      .then(() => {
        if (mounted.current && revision.current === version) setError(undefined);
      })
      .catch(() => {
        if (mounted.current && revision.current === version)
          setError('native_settings.storage_error');
      });
  }, []);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const value = useMemo(
    () => ({ locale, t, changeLocale, error }),
    [locale, t, changeLocale, error],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useI18n() {
  const context = useContext(Context);
  if (!context) throw new Error('NativeI18nProvider is required');
  return context;
}
