'use client';
import { useEffect, useRef, useState } from 'react';
import { authErrorKey, createAccountApi, type PlatformAccountApi } from '../../../lib/api/account';

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset';
export function useAuthForm(
  initialMode: AuthMode = 'login',
  apiFactory: () => PlatformAccountApi = createAccountApi,
) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmailValue] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authenticatedUserId, setAuthenticatedUserId] = useState('');
  const flight = useRef(false);
  const mounted = useRef(true);
  const normalizedEmail = email.trim().toLowerCase();
  const registrationSent = mode === 'register' && sentEmail === normalizedEmail && !!sentEmail;
  const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= retryAt) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [retryAt]);
  function validEmail() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('account.emailInvalid');
      return false;
    }
    return true;
  }
  function consent() {
    if ((mode === 'login' || mode === 'register') && !accepted) {
      setError('account.acceptRequired');
      return false;
    }
    return true;
  }
  async function run(action: (api: PlatformAccountApi) => Promise<void>) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action(apiFactory());
    } catch (failure) {
      if (mounted.current) setError(authErrorKey(failure));
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function sendCode() {
    if (flight.current || !consent() || !validEmail() || Date.now() < retryAt) return;
    if (mode === 'register' && password.length < 8) {
      setError('account.passwordShort');
      return;
    }
    return run(async (api) => {
      if (mode === 'register')
        await api.sendRegistration(normalizedEmail, password, registrationSent);
      else await api.forgot(normalizedEmail);
      if (!mounted.current) return;
      setSentEmail(normalizedEmail);
      setCode('');
      setNow(Date.now());
      setRetryAt(Date.now() + 60000);
      setNotice(mode === 'register' ? 'account.registrationSent' : 'account.recoverySent');
      if (mode === 'forgot') setMode('reset');
    });
  }
  function submit() {
    if (mode === 'forgot') return sendCode();
    if (flight.current || !consent() || !validEmail()) return;
    if (password.length < (mode === 'login' ? 1 : 8)) {
      setError(mode === 'login' ? 'account.passwordRequired' : 'account.passwordShort');
      return;
    }
    if (mode !== 'login' && !/^\d{6}$/.test(code)) {
      setError('account.invalidCode');
      return;
    }
    if (mode === 'register' && !registrationSent) {
      setError('account.sendFirst');
      return;
    }
    if (mode === 'reset' && password !== confirm) {
      setError('account.passwordMismatch');
      return;
    }
    return run(async (api) => {
      if (mode === 'reset') {
        await api.reset(normalizedEmail, code, password);
        if (!mounted.current) return;
        setMode('login');
        setNotice('account.resetDone');
      } else {
        const id =
          mode === 'register'
            ? await api.verifyRegistration(normalizedEmail, code)
            : await api.login(normalizedEmail, password);
        if (!mounted.current) return;
        setAuthenticatedUserId(id);
      }
      setPassword('');
      setConfirm('');
      setCode('');
      setSentEmail('');
    });
  }
  function google(redirectTo: string) {
    if (flight.current) return;
    return run(async (api) => {
      const url = await api.google(redirectTo);
      if (mounted.current) window.location.assign(url);
    });
  }
  return {
    mode,
    email,
    password,
    confirm,
    code,
    accepted,
    busy,
    error,
    notice,
    seconds,
    registrationSent,
    authenticatedUserId,
    setPassword,
    setConfirm,
    setCode,
    setAccepted,
    submit,
    sendCode,
    google,
    setEmail(value: string) {
      if (flight.current) return;
      setEmailValue(value);
      setCode('');
      setSentEmail('');
      setNotice('');
    },
    open(next: AuthMode) {
      if (flight.current) return;
      setMode(next);
      setPassword('');
      setConfirm('');
      setCode('');
      setSentEmail('');
      setError('');
      setNotice('');
    },
  };
}
