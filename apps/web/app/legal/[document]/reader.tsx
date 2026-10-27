'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LegalDocumentContent, legalAnchor, legalLink, type LegalDocumentId } from '@vocespace/ui';
import { useI18n } from '@/lib/i18n/i18n';
import styles from './styles.module.scss';
export function LegalReader({ documentId }: { documentId: LegalDocumentId }) {
  const { t } = useI18n();
  const router = useRouter();
  const page = useRef<HTMLElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const anchor = legalAnchor(window.location.hash.slice(1));
      if (anchor) document.getElementById(anchor)?.scrollIntoView();
      else page.current?.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [documentId]);
  return (
    <main ref={page} className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
        >
          {t('common.back')}
        </button>
        <span>{t(`legal.${documentId}`)}</span>
      </header>
      <LegalDocumentContent
        documentId={documentId}
        onOpenLink={(href) => {
          const link = legalLink(href, documentId);
          if (link) {
            const anchor = legalAnchor(link.anchor);
            if (link.documentId === documentId) {
              if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' });
              else page.current?.scrollTo({ top: 0, behavior: 'smooth' });
            } else router.push(`/legal/${link.documentId}${anchor ? `#${anchor}` : ''}`);
          } else if (/^(https:\/\/|mailto:)/i.test(href)) window.location.assign(href);
        }}
      />
    </main>
  );
}
