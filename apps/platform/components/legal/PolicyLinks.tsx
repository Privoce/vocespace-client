'use client';
import Link from 'next/link';
import { useI18n } from '../../lib/i18n/i18n';
export function PolicyLinks() {
  const { t } = useI18n();
  return (
    <>
      <Link href="/policy/terms" target="_blank" rel="noopener noreferrer">
        {t('account.terms')}
      </Link>
      {' · '}
      <Link href="/policy/privacy" target="_blank" rel="noopener noreferrer">
        {t('account.privacy')}
      </Link>
    </>
  );
}
