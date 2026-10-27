'use client';
import { useEffect, useState } from 'react';
import { Button, Input, Alert } from 'antd';
import { useI18n } from '@/lib/i18n/i18n';
import { SvgResource } from '@/components/Icon';
import styles from './page.module.scss';
import { apiFetch } from '@/lib/api/client';

/** Email OTP reset and legacy one-use HttpOnly recovery; no auth token enters browser storage. */
export default function ResetPasswordPage() {
  const { t } = useI18n();
  const text = (key: string) => t(`account_auth.${key}`);
  const [state, setState] = useState<'form' | 'invalid' | 'confirmed' | 'done'>('form');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [legacy, setLegacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setLegacy(params.get('method') === 'link');
    if (params.has('invalid')) setState('invalid');
    if (params.has('confirmed')) setState('confirmed');
  }, []);
  const submit = async () => {
    if (busy) return;
    if (password.length < 8 || (legacy && password !== confirm)) {
      setError(text(password.length < 8 ? 'password_short' : 'password_mismatch'));
      return;
    }
    if (!legacy && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !/^\d{6}$/.test(code))) {
      setError(text('invalid_code'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(
        legacy ? '/api/v1/account/reset-password' : '/api/v1/account/reset-code',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Vocespace-Request': '1' },
          body: JSON.stringify(legacy ? { password } : { email, code, password }),
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(
          text(
            result.code === 'AUTH_RATE_LIMITED'
              ? 'rate_limited'
              : result.code === 'PASSWORD_TOO_WEAK'
                ? 'password_short'
                : legacy
                  ? 'recovery_failed'
                  : 'invalid_code',
          ),
        );
        return;
      }
      setPassword('');
      setConfirm('');
      setCode('');
      setState('done');
    } catch {
      setError(text('unavailable'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className={styles.page}>
      <header className={styles.brand}>
        <SvgResource type="logo2" width="280px" height="64px" />
        <p>{t('native_account.brand_tagline')}</p>
        <small>{t('native_account.brand_motto')}</small>
      </header>
      <section className={styles.card}>
        <h1>{text('reset_password')}</h1>
        <p>{text('reset_code_hint')}</p>
        {state !== 'form' ? (
          <Alert
            type={state === 'invalid' ? 'error' : 'success'}
            title={text(
              state === 'invalid'
                ? 'recovery_failed'
                : state === 'confirmed'
                  ? 'email_confirmed'
                  : 'reset_done',
            )}
          />
        ) : (
          <form
            style={{ display: 'grid', gap: 16 }}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {!legacy && (
              <>
                <Input
                  aria-label={t('native_account.email')}
                  placeholder={t('native_account.email')}
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                />
                <label>{text('code_label')}</label>
                <Input.OTP
                  length={6}
                  value={code}
                  onChange={setCode}
                  onInput={(values) => setCode(values.join(''))}
                  formatter={(value) => value.replace(/\D/g, '')}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={busy}
                />
              </>
            )}
            <Input.Password
              aria-label={text('new_password')}
              placeholder={text('new_password')}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
            />
            {legacy && (
              <Input.Password
                aria-label={text('confirm_password')}
                placeholder={text('confirm_password')}
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                disabled={busy}
              />
            )}
            {error && <Alert type="error" title={error} />}
            <Button type="primary" htmlType="submit" loading={busy}>
              {text('save_reset')}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
