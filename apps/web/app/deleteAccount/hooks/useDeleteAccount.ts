import { analytics, setWebAnalyticsContext } from '@/lib/analytics';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api/client';

class RequestError extends Error {
  constructor(readonly code: string) { super(code); }
}
async function request(action: string, body: unknown = {}, signal?: AbortSignal) {
  const response = await apiFetch(`/api/v1/account/web-${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Vocespace-Request': '1' },
    body: JSON.stringify(body), signal,
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new RequestError(value.code || 'AUTH_UNAVAILABLE');
  return value as { email?: string };
}
export function useDeleteAccount() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedIn, setSignedIn] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(false);
  const flight = useRef(false);
  const mounted = useRef(true);
  const report = (error: unknown) => {
    const code = error instanceof RequestError ? error.code : 'AUTH_UNAVAILABLE';
    const keys: Record<string, string> = {
      AUTH_SESSION_REQUIRED: 'delete_web.session_expired',
      AUTH_INVALID_CREDENTIALS: 'account_auth.invalid_credentials',
      EMAIL_NOT_CONFIRMED: 'account_auth.confirm_email',
      AUTH_RATE_LIMITED: 'account_auth.rate_limited',
      ACCOUNT_DELETION_NOT_CONFIGURED: 'account_auth.deletion_not_configured',
      ACCOUNT_DELETION_FAILED: 'account_auth.deletion_failed',
      AUTH_NOT_CONFIGURED: 'account_auth.not_configured',
    };
    setError(keys[code] || 'account_auth.unavailable');
  };
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void request('session', {}, controller.signal).then((result) => {
      if (!controller.signal.aborted) setSignedIn(result.email);
    }).catch((error) => {
      if (!controller.signal.aborted && !(error instanceof RequestError &&
          ['AUTH_SESSION_REQUIRED', 'AUTH_INVALID_CREDENTIALS'].includes(error.code))) report(error);
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false);
    });
    return () => { mounted.current = false; controller.abort(); };
  }, []);
  useEffect(() => { setWebAnalyticsContext({ auth_state: signedIn ? 'signed_in' : 'guest' }); }, [signedIn]);
  const submit = async () => {
    if (busy || flight.current || !password || (signedIn && !confirmed)) return;
    flight.current = true;
    setBusy(true);
    setError('');
    setRetry(false);
    const operation = analytics.begin(signedIn ? 'account_delete' : 'account_login', { source: 'delete_account', method: 'email_password' });
    try {
      const result = await request(signedIn ? 'delete' : 'login', signedIn
        ? { password, confirm: 'DELETE' } : { email: email.trim(), password });
      operation.end('success');
      if (!mounted.current) return;
      setPassword('');
      setConfirmed(false);
      if (signedIn) { setDone(true); setSignedIn(undefined); }
      else setSignedIn(result.email);
    } catch (error) {
      operation.fail(error);
      if (!mounted.current) return;
      report(error);
      if (signedIn) { setSignedIn(undefined); setPassword(''); setConfirmed(false); setRetry(true); }
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const logout = async () => {
    if (busy || flight.current) return;
    flight.current = true;
    setLoggingOut(true);
    setBusy(true);
    setError('');
    try {
      await request('logout');
      if (mounted.current) { setSignedIn(undefined); setPassword(''); setConfirmed(false); }
    } catch (error) { if (mounted.current) report(error); }
    finally {
      flight.current = false;
      if (mounted.current) { setBusy(false); setLoggingOut(false); }
    }
  };
  return { email, setEmail, password, setPassword, signedIn, confirmed, setConfirmed,
    done, busy, loggingOut, error, retry, submit, logout };
}
