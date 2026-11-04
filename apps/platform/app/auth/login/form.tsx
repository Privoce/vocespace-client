'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Divider, Input } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LangSelect } from '../../../components/widget/lang';
import { PolicyLinks } from '../../../components/legal/PolicyLinks';
import { useI18n } from '../../../lib/i18n/i18n';
import { createClient } from '../../../lib/supabase/client';
import { dbApi } from '../../../lib/api/db';
import { vocespaceUrl } from '../../../lib/std/space';
import { useAuthForm, type AuthMode } from '../hooks/useAuthForm';
import styles from '../../../styles/login.module.scss';

export function AuthForm({ initialMode = 'login' }: { initialMode?: AuthMode }) {
  const { t } = useI18n();
  const form = useAuthForm(initialMode);
  const router = useRouter();
  const query = useSearchParams();
  const from = query.get('from');
  const spaceName = query.get('spaceName') || '';
  const [redirectError, setRedirectError] = useState(false);
  const [redirectAttempt, setRedirectAttempt] = useState(0);
  useEffect(() => {
    if (!form.authenticatedUserId) return;
    let active = true;
    async function navigate() {
      setRedirectError(false);
      const user = await dbApi.userInfo.getOrNull(createClient(), form.authenticatedUserId);
      if (!active) return;
      if (user?.username && (from === 'vocespace' || from === 'space')) {
        const destination = await vocespaceUrl(user, 'vocespace', spaceName || user.username);
        if (active) window.location.assign(destination);
      } else {
        const context = new URLSearchParams();
        if (from === 'vocespace' || from === 'space') {
          context.set('from', from);
          if (spaceName) context.set('spaceName', spaceName);
        }
        router.replace(
          `/auth/user/${form.authenticatedUserId}${context.size ? `?${context}` : ''}`,
        );
      }
    }
    void navigate().catch(() => {
      if (active) setRedirectError(true);
    });
    return () => {
      active = false;
    };
  }, [form.authenticatedUserId, from, spaceName, router, redirectAttempt]);
  const register = form.mode === 'register';
  const reset = form.mode === 'reset';
  const recovery = reset || form.mode === 'forgot';
  const consentRequired = !recovery;
  const busy = form.busy || !!form.authenticatedUserId;
  const title = register ? 'account.register' : recovery ? 'account.forgotTitle' : 'login.welcome';
  const google = () => {
    const callback = new URL('/auth/callback', window.location.origin);
    if (from === 'vocespace' || from === 'space') {
      callback.searchParams.set('from', from);
      if (spaceName) callback.searchParams.set('spaceName', spaceName);
    }
    void form.google(callback.toString());
  };
  return (
    <div className={styles.login}>
      <div className={styles.login_lang}>
        <LangSelect />
      </div>
      <section className={styles.login_left}>
        <header className={styles.login_left_header}>
          <Link href="/">
            <img src="/logo.svg" alt="VoceSpace" />
          </Link>
        </header>
        <main className={styles.login_left_main}>
          <div className={styles.login_left_main_tt}>
            <h1 className={styles.login_left_main_tt_title}>{t(title)}</h1>
            <p className={styles.login_left_main_tt_subtitle}>
              {t(
                recovery
                  ? 'account.recoveryIntro'
                  : register
                    ? 'account.registerIntro'
                    : 'login.continue',
              )}
            </p>
          </div>
          {!recovery && (
            <>
              <Button block size="large" disabled={busy} onClick={google}>
                <img src="/google.svg" width="20" height="20" alt="" /> {t('account.google')}
              </Button>
              <Divider>{t('account.or')}</Divider>
            </>
          )}
          <form
            className={styles.login_left_main_form}
            onSubmit={(e) => {
              e.preventDefault();
              void form.submit();
            }}
          >
            <div className={styles.login_form_input}>
              <label htmlFor="account-email" className={styles.login_form_input_title}>
                {t('account.email')}
              </label>
              <Input
                id="account-email"
                type="email"
                autoComplete="email"
                size="large"
                maxLength={254}
                disabled={busy}
                value={form.email}
                onChange={(e) => form.setEmail(e.target.value)}
                placeholder={t('login.placeholder.email')}
              />
            </div>
            {form.mode !== 'forgot' && (
              <div className={styles.login_form_input}>
                <label htmlFor="account-password" className={styles.login_form_input_title}>
                  {t(reset ? 'account.newPassword' : 'login.password')}
                </label>
                <Input.Password
                  id="account-password"
                  size="large"
                  autoComplete={form.mode === 'login' ? 'current-password' : 'new-password'}
                  maxLength={256}
                  disabled={busy || form.registrationSent}
                  value={form.password}
                  onChange={(e) => form.setPassword(e.target.value)}
                />
                {form.registrationSent && (
                  <p className={styles.hint}>{t('account.passwordLocked')}</p>
                )}
              </div>
            )}
            {reset && (
              <div className={styles.login_form_input}>
                <label htmlFor="account-confirm" className={styles.login_form_input_title}>
                  {t('account.confirmPassword')}
                </label>
                <Input.Password
                  id="account-confirm"
                  size="large"
                  autoComplete="new-password"
                  maxLength={256}
                  disabled={busy}
                  value={form.confirm}
                  onChange={(e) => form.setConfirm(e.target.value)}
                />
              </div>
            )}
            {(register || reset) && (
              <div className={styles.login_form_input}>
                <label htmlFor="account-code" className={styles.login_form_input_title}>
                  {t('account.code')}
                </label>
                <div className={styles.codeRow}>
                  <Input
                    id="account-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    size="large"
                    disabled={busy}
                    value={form.code}
                    onChange={(e) => form.setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('account.codePlaceholder')}
                  />
                  <Button
                    size="large"
                    onClick={() => void form.sendCode()}
                    disabled={busy || form.seconds > 0 || (register && !form.accepted)}
                  >
                    {form.seconds > 0
                      ? t('account.countdown').replace('$seconds', String(form.seconds))
                      : t(form.registrationSent || reset ? 'account.resend' : 'account.sendCode')}
                  </Button>
                </div>
              </div>
            )}
            {consentRequired && (
              <div className={styles.consent}>
                <Checkbox
                  aria-label={t('account.acceptLabel')}
                  checked={form.accepted}
                  disabled={busy}
                  onChange={(e) => form.setAccepted(e.target.checked)}
                />
                <span>
                  {t('account.acceptPrefix')} <PolicyLinks />
                </span>
              </div>
            )}
            {form.error && <Alert type="error" showIcon message={t(form.error)} role="alert" />}
            {form.notice && (
              <Alert type="success" showIcon message={t(form.notice)} role="status" />
            )}
            {redirectError && (
              <Alert
                type="error"
                message={t('account.entryFailed')}
                role="alert"
                action={
                  <Button onClick={() => setRedirectAttempt((value) => value + 1)}>
                    {t('discovery.retry')}
                  </Button>
                }
              />
            )}
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={busy && !redirectError}
              disabled={
                busy ||
                (consentRequired && !form.accepted) ||
                (form.mode === 'forgot' && form.seconds > 0)
              }
            >
              {t(
                register
                  ? 'account.verifyRegister'
                  : reset
                    ? 'account.savePassword'
                    : form.mode === 'forgot'
                      ? 'account.sendCode'
                      : 'login.signin',
              )}
            </Button>
          </form>
          <div className={styles.login_left_main_signup}>
            {form.mode === 'login' ? (
              <>
                <Button type="link" disabled={busy} onClick={() => form.open('forgot')}>
                  {t('login.forgetPwd')}
                </Button>
                <Button type="link" disabled={busy} onClick={() => form.open('register')}>
                  {t('login.createAccount')}
                </Button>
              </>
            ) : (
              <Button type="link" disabled={busy} onClick={() => form.open('login')}>
                {t('account.backLogin')}
              </Button>
            )}
          </div>
        </main>
        <footer className={styles.login_left_footer}>
          <PolicyLinks />
          <span>{t('common.copyright')}</span>
        </footer>
      </section>
      <aside className={styles.login_right}>
        <div className={styles.login_right_content}>
          <h2 className={styles.login_right_content_title}>{t('login.sideTitle')}</h2>
          <h3 className={styles.login_right_content_subtitle}>{t('login.sideSubtitle')}</h3>
        </div>
      </aside>
    </div>
  );
}
