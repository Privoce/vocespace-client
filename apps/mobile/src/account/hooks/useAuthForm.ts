import { useEffect, useRef, useState } from 'react';
import type { AccountModel } from './useAccount';

export function useAuthForm(account: AccountModel) {
  const [email, setEmailValue] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [remember, setRemember] = useState(true);
  const [invalid, setInvalid] = useState<string>();
  const [sentEmail, setSentEmail] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const flight = useRef(false);
  const normalizedEmail = email.trim().toLowerCase();
  const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const registrationSent = sentEmail === normalizedEmail && !!sentEmail;
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= retryAt) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [retryAt]);
  const validEmail = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setInvalid('native_account.email_invalid');
      return false;
    }
    return true;
  };
  const consentRequired = () => {
    if (!accepted && (account.screen === 'login' || account.screen === 'register')) {
      setInvalid('legal.accept_required');
      return true;
    }
    return false;
  };
  const sendCode = async () => {
    if (account.screen === 'register' && consentRequired()) return;
    if (flight.current || account.busy || Date.now() < retryAt || !validEmail()) return;
    if (account.screen === 'register' && password.length < 8) {
      setInvalid('account_auth.password_short');
      return;
    }
    flight.current = true;
    setInvalid(undefined);
    try {
      const registration = account.screen === 'register';
      const ok = registration
        ? await account.sendRegistrationCode(normalizedEmail, password, registrationSent)
        : await account.forgot(normalizedEmail, account.screen === 'reset');
      if (ok) {
        if (registration) setSentEmail(normalizedEmail);
        setCode('');
        setNow(Date.now());
        setRetryAt(Date.now() + 60_000);
      }
    } finally {
      flight.current = false;
    }
  };
  const submit = async () => {
    if (account.screen === 'forgot') return sendCode();
    if (consentRequired()) return;
    if (flight.current || account.busy || !validEmail()) return;
    if (password.length < (account.screen === 'login' ? 1 : 8)) {
      setInvalid('account_auth.password_short');
      return;
    }
    if (account.screen !== 'login' && !/^\d{6}$/.test(code)) {
      setInvalid('account_auth.invalid_code');
      return;
    }
    if (account.screen === 'register' && !registrationSent) {
      setInvalid('account_auth.send_code_first');
      return;
    }
    flight.current = true;
    setInvalid(undefined);
    try {
      const ok =
        account.screen === 'reset'
          ? await account.resetPassword(normalizedEmail, code, password)
          : await account.authenticate(normalizedEmail, password, remember, code);
      if (ok) {
        setPassword('');
        setCode('');
        setSentEmail('');
      }
    } finally {
      flight.current = false;
    }
  };
  return {
    email,
    setEmail: (value: string) => {
      setEmailValue(value);
      setCode('');
      setSentEmail('');
    },
    password,
    setPassword,
    code,
    setCode,
    accepted,
    setAccepted: (value: boolean) => {
      setAccepted(value);
      if (value && invalid === 'legal.accept_required') setInvalid(undefined);
    },
    remember,
    setRemember,
    invalid,
    submit,
    sendCode,
    seconds,
    registrationSent,
    open: (mode: Parameters<AccountModel['open']>[0]) => {
      if (account.busy || flight.current) return;
      setInvalid(undefined);
      setPassword('');
      setCode('');
      setSentEmail('');
      account.open(mode);
    },
  };
}
