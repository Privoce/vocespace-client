'use client';
import { useEffect, useState } from 'react';
import { Button, Input, Alert } from 'antd';
import { useI18n } from '@/lib/i18n/i18n';
import { apiFetch } from '@/lib/api/client';

/** Only an HttpOnly, one-use recovery cookie reaches this page; tokens stay at the API. */
export default function ResetPasswordPage() {
  const { t } = useI18n();
  const text = (key: string) => t(`account_auth.${key}`);
  const [state, setState] = useState<'form' | 'invalid' | 'confirmed' | 'done'>('form');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('invalid')) setState('invalid');
    if (params.has('confirmed')) setState('confirmed');
  }, []);
  const submit = async () => {
    if (busy) return;
    if (password.length < 8 || password !== confirm) {
      setError(text('password_mismatch'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch('/api/v1/account/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Vocespace-Request': '1' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError(text('recovery_failed'));
        return;
      }
      setPassword('');
      setConfirm('');
      setState('done');
    } catch {
      setError(text('unavailable'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main style={{ maxWidth: 440, margin: '60px auto', padding: 24 }}>
      <h1>{text('reset_password')}</h1>
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
          <Input.Password
            aria-label={text('new_password')}
            placeholder={text('new_password')}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
          <Input.Password
            aria-label={text('confirm_password')}
            placeholder={text('confirm_password')}
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            disabled={busy}
          />
          {error && <Alert type="error" title={error} />}
          <Button type="primary" htmlType="submit" loading={busy}>
            {text('reset_password')}
          </Button>
        </form>
      )}
    </main>
  );
}
