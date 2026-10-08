import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultSettings, parseSettings, settingsKey, type LocalSettings } from './model';

export function useLocalSettings() {
  const [settings, setSettings] = useState<LocalSettings>({ ...defaultSettings });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const current = useRef(settings);
  const writes = useRef(Promise.resolve());
  const mounted = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    AsyncStorage.getItem(settingsKey).then((raw) => {
      if (!active) return;
      current.current = parseSettings(raw);
      setSettings(current.current);
    }).catch(() => {
      if (active) setError('暂时无法读取本机设置，可重新设置。');
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; mounted.current = false; };
  }, []);

  const update = useCallback((patch: Partial<LocalSettings>) => {
    if (!ready) return;
    const next = { ...current.current, ...patch };
    current.current = next;
    setSettings(next);
    const version = ++revision.current;
    // Serialize disk writes so a slower previous save cannot overwrite a newer preference.
    writes.current = writes.current.then(() => AsyncStorage.setItem(settingsKey, JSON.stringify(next)))
      .then(() => { if (mounted.current && revision.current === version) setError(undefined); })
      .catch(() => {
        if (mounted.current && revision.current === version) setError('设置尚未保存，请重新修改后重试。');
      });
  }, [ready]);

  return { settings, ready, error, update };
}
