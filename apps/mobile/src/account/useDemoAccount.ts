import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { demoCredentials } from './config';
import {
  accountProfileKey,
  accountSessionKey,
  defaultProfile,
  matchesDemoCredentials,
  parseDemoProfile,
  type AuthMode,
  type DemoProfile,
} from './model';

/** UI prototype identity only: it neither mints nor replaces the Native API bearer session. */
export function useDemoAccount() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(() => defaultProfile(demoCredentials.email));
  const [signedIn, setSignedIn] = useState(false);
  const [screen, setScreen] = useState<AuthMode | null>('login');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const revision = useRef(0);
  const flight = useRef(false);
  const writes = useRef(Promise.resolve());
  const currentProfile = useRef(profile);
  useEffect(() => {
    active.current = true;
    let mounted = true;
    void Promise.all([
      AsyncStorage.getItem(accountProfileKey),
      AsyncStorage.getItem(accountSessionKey),
    ])
      .then(([raw, session]) => {
        if (!mounted) return;
        currentProfile.current = parseDemoProfile(raw, demoCredentials.email);
        setProfile(currentProfile.current);
        if (session === demoCredentials.email) {
          setSignedIn(true);
          setScreen(null);
        }
      })
      .catch(() => {
        if (mounted) setError('native_account.storage_error');
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
      active.current = false;
      ++revision.current;
    };
  }, []);
  const writeSession = (email?: string) => {
    const operation = writes.current
      .catch(() => {})
      .then(() =>
        email
          ? AsyncStorage.setItem(accountSessionKey, email)
          : AsyncStorage.removeItem(accountSessionKey),
      );
    writes.current = operation.catch(() => {});
    return operation;
  };
  const authenticate = async (email: string, password: string, remember: boolean) => {
    if (!ready || flight.current) return false;
    if (!matchesDemoCredentials({ email, password }, demoCredentials)) {
      setError('native_account.credentials_error');
      return false;
    }
    flight.current = true;
    setBusy(true);
    setError(undefined);
    const version = ++revision.current;
    try {
      await writeSession(remember ? demoCredentials.email : undefined);
      if (!active.current || version !== revision.current) return false;
      setSignedIn(true);
      setScreen(null);
      return true;
    } catch {
      if (active.current) setError('native_account.storage_error');
      return false;
    } finally {
      flight.current = false;
      if (active.current) setBusy(false);
    }
  };
  const logout = async () => {
    if (flight.current) return false;
    flight.current = true;
    setBusy(true);
    try {
      await writeSession();
      if (active.current) {
        ++revision.current;
        setSignedIn(false);
        setScreen(null);
        setError(undefined);
      }
      return true;
    } catch {
      if (active.current) setError('native_account.storage_error');
      return false;
    } finally {
      flight.current = false;
      if (active.current) setBusy(false);
    }
  };
  const update = (patch: Partial<Pick<DemoProfile, 'nickname' | 'notifications' | 'gestures'>>) => {
    const next = { ...currentProfile.current, ...patch };
    if (!next.nickname.trim()) return;
    next.nickname = next.nickname.trim().slice(0, 30);
    currentProfile.current = next;
    setProfile(next);
    writes.current = writes.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(accountProfileKey, JSON.stringify(next)))
      .catch(() => {
        if (active.current) setError('native_account.storage_error');
      });
  };
  return {
    ready,
    profile,
    signedIn,
    screen,
    error,
    busy,
    authenticate,
    logout,
    update,
    open: (mode: AuthMode) => {
      setError(undefined);
      setScreen(mode);
    },
    browse: () => {
      if (!flight.current) {
        ++revision.current;
        setScreen(null);
        setError(undefined);
      }
    },
  };
}
export type DemoAccountModel = ReturnType<typeof useDemoAccount>;
