import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '@vocespace/client-sdk';
import { parseAccountSession, type AccountSession, type AccountUser } from '@vocespace/contracts';
import { configuredAccountClient } from '../client';
import type { AuthMode } from '../model';
const prefsKey = (id: string) => `vocespace.account.preferences.${id}`;
const errorKeys: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'invalid_credentials',
  EMAIL_NOT_CONFIRMED: 'confirm_email',
  AUTH_RATE_LIMITED: 'rate_limited',
  EMAIL_ALREADY_REGISTERED: 'email_exists',
  PASSWORD_TOO_SHORT: 'password_short',
  PASSWORD_TOO_WEAK: 'password_short',
  AUTH_NOT_CONFIGURED: 'not_configured',
  ACCOUNT_DELETION_NOT_CONFIGURED: 'deletion_not_configured',
  ACCOUNT_DELETION_FAILED: 'deletion_failed',
};
const failure = (error: unknown) => {
  const code = error instanceof ApiError ? error.code : 'AUTH_UNAVAILABLE';
  return `account_auth.${errorKeys[code] || 'unavailable'}`;
};

export function useAccount() {
  const [client] = useState(configuredAccountClient);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AccountUser>();
  const [screen, setScreen] = useState<AuthMode | null>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [preferences, setPreferences] = useState({ notifications: true, gestures: true });
  const session = useRef<AccountSession | undefined>(undefined);
  const remember = useRef(true);
  const active = useRef(false);
  const flight = useRef(false);
  async function persist(next: AccountSession) {
    if (!client) throw new Error();
    // Keep a rotated refresh token in memory even when keychain is temporarily unavailable.
    session.current = next;
    if (remember.current) await client.write(JSON.stringify(next));
    else await client.clear();
  }
  async function validated() {
    if (!client || !session.current) throw new ApiError(401, 'AUTH_SESSION_REQUIRED', 'No account');
    if (session.current.expiresAt <= Date.now() + 60_000)
      await persist(await client.api.refresh(session.current.refreshToken));
    const current = await client.api.me(session.current!.accessToken);
    session.current!.user = current;
    return current;
  }
  const latestValidated = useRef(validated);
  latestValidated.current = validated;
  useEffect(() => {
    active.current = true;
    const restore = async (initial = false) => {
      if (flight.current) return;
      flight.current = true;
      try {
        if (!client) return;
        if (initial) {
          const raw = await client.read();
          if (!raw) return;
          try {
            session.current = parseAccountSession(JSON.parse(raw));
          } catch {
            await client.clear();
            return;
          }
        }
        if (!session.current) return;
        const current = await latestValidated.current();
        const raw = await AsyncStorage.getItem(prefsKey(current.id));
        if (!active.current) return;
        setUser(current);
        setScreen(null);
        setError(undefined);
        try {
          const saved = JSON.parse(raw || '{}');
          setPreferences({
            notifications: saved.notifications !== false,
            gestures: saved.gestures !== false,
          });
        } catch {
          setPreferences({ notifications: true, gestures: true });
        }
      } catch (error) {
        if (!active.current) return;
        if (error instanceof ApiError && error.status === 401) {
          session.current = undefined;
          await client?.clear().catch(() => undefined);
          setUser(undefined);
          setScreen('login');
        }
        setError(failure(error));
      } finally {
        flight.current = false;
        if (active.current && initial) setReady(true);
      }
    };
    void restore(true);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void restore();
    });
    return () => {
      active.current = false;
      subscription.remove();
    };
    // The configured client is stable; session and transport live in refs.
  }, [client]);
  async function run(work: () => Promise<void>) {
    if (flight.current || !ready) return false;
    if (!client) {
      setError('account_auth.not_configured');
      return false;
    }
    flight.current = true;
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await work();
      return true;
    } catch (error) {
      if (active.current) setError(failure(error));
      return false;
    } finally {
      flight.current = false;
      if (active.current) setBusy(false);
    }
  }
  const authenticate = (email: string, password: string, save: boolean) =>
    run(async () => {
      remember.current = save;
      const result =
        screen === 'register'
          ? await client!.api.register(email, password)
          : { session: await client!.api.login(email, password) };
      if (!result.session) {
        setMessage('account_auth.confirm_email');
        setScreen('login');
        return;
      }
      try {
        await persist(result.session);
      } catch (error) {
        await client!.api.logout(result.session.accessToken).catch(() => undefined);
        session.current = undefined;
        await client!.clear().catch(() => undefined);
        throw error;
      }
      if (!active.current) return;
      setUser(result.session.user);
      setPreferences({ notifications: true, gestures: true });
      setScreen(null);
      // Profile is refreshed by /me, using the platform's existing user_info record.
      try {
        const current = await validated();
        if (active.current) setUser(current);
      } catch {
        /* Login already succeeded; retry profile lookup on foreground. */
      }
    });
  const logout = () =>
    run(async () => {
      if (session.current) {
        try {
          if (session.current.expiresAt <= Date.now())
            await persist(await client!.api.refresh(session.current.refreshToken));
          await client!.api.logout(session.current!.accessToken);
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 401)) throw error;
        }
      }
      await client!.clear();
      session.current = undefined;
      setUser(undefined);
      setScreen(null);
    });
  const remove = (password: string) =>
    run(async () => {
      const current = await validated();
      await client!.api.remove(session.current!.accessToken, password);
      session.current = undefined;
      setUser(undefined);
      setScreen('login');
      await client!.clear();
      await AsyncStorage.removeItem(prefsKey(current.id));
      setMessage('account_auth.deleted');
    });
  return {
    ready,
    busy,
    error,
    message,
    screen,
    signedIn: !!user,
    profile: {
      id: user?.id || '',
      email: user?.email || '',
      nickname: user?.nickname || '',
      ...preferences,
    },
    authenticate,
    logout,
    remove,
    forgot: (email: string) =>
      run(async () => {
        await client!.api.forgot(email);
        setMessage('account_auth.reset_sent');
      }),
    update: (patch: Partial<{ nickname: string; notifications: boolean; gestures: boolean }>) => {
      // Notification/gesture preferences stay local. Nickname edits are display-only for this phase.
      if (patch.nickname && user)
        setUser({ ...user, nickname: patch.nickname.trim().slice(0, 30) });
      const next = {
        notifications: patch.notifications ?? preferences.notifications,
        gestures: patch.gestures ?? preferences.gestures,
      };
      setPreferences(next);
      if (user)
        void AsyncStorage.setItem(prefsKey(user.id), JSON.stringify(next)).catch(() =>
          setError('native_account.storage_error'),
        );
    },
    open: (mode: AuthMode) => {
      if (!flight.current) {
        setError(undefined);
        setMessage(undefined);
        setScreen(mode);
      }
    },
    browse: () => {
      if (!flight.current) {
        setScreen(null);
        setError(undefined);
        setMessage(undefined);
      }
    },
  };
}
export type AccountModel = ReturnType<typeof useAccount>;
