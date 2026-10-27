'use client';
import Link from 'next/link';
import { Alert, Button, Checkbox, Input } from 'antd';
import { useI18n } from '@/lib/i18n/i18n';
import { useDeleteAccount } from './hooks/useDeleteAccount';
import styles from './page.module.scss';

export function DeleteAccountContent() {
  const { t } = useI18n();
  const m = useDeleteAccount();
  return (
    <main className={styles.page}>
      <header><Link href="/">VoceSpace</Link></header>
      <section className={styles.card}>
        <h1>{t('delete_web.title')}</h1>
        <p>{t('delete_web.intro')}</p>
        <p>{t('delete_web.scope')}</p>
        <p>{t('delete_web.timing')}</p>
        {m.done ? <Alert type="success" title={t('account_auth.deleted')} /> : (
          <form onSubmit={(event) => { event.preventDefault(); void m.submit(); }}>
            {m.signedIn ? (
              <p className={styles.identity}>{t('delete_web.signed_in')}: <strong>{m.signedIn}</strong></p>
            ) : (
              <label>
                {t('native_account.email')}
                <Input type="email" autoComplete="username" required maxLength={254}
                  value={m.email} disabled={m.busy}
                  onChange={(event) => m.setEmail(event.target.value)} />
              </label>
            )}
            <label>
              {t(m.signedIn ? 'delete_web.password' : 'native_account.password')}
              <Input.Password autoComplete="current-password" required maxLength={256}
                value={m.password} disabled={m.busy}
                onChange={(event) => m.setPassword(event.target.value)} />
            </label>
            {m.signedIn && <Checkbox checked={m.confirmed} disabled={m.busy}
              onChange={(event) => m.setConfirmed(event.target.checked)}>
              {t('delete_web.confirm')}
            </Checkbox>}
            {m.error && <Alert type="error" title={t(m.error)}
              description={m.retry ? t('delete_web.retry') : undefined} />}
            <Button type="primary" danger={!!m.signedIn} htmlType="submit" loading={m.busy && !m.loggingOut}
              disabled={m.busy || !m.password || (!m.signedIn && !m.email.trim()) || (!!m.signedIn && !m.confirmed)}>
              {t(m.signedIn ? 'account_auth.delete_confirm' : 'delete_web.login')}
            </Button>
            {m.signedIn && <Button onClick={() => void m.logout()} disabled={m.busy} loading={m.loggingOut}>
              {t('delete_web.switch_account')}
            </Button>}
          </form>
        )}
        <footer>
          <Link href="/legal/privacy">{t('delete_web.privacy')}</Link>
          <p>{t('delete_web.support')} <a href="mailto:han@privoce.com">han@privoce.com</a></p>
        </footer>
      </section>
    </main>
  );
}
