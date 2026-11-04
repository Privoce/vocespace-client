'use client';
import { Children, isValidElement, type ReactNode } from 'react';
import Link from 'next/link';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '../../lib/i18n/i18n';
import { PolicyLinks } from './PolicyLinks';
import styles from '../../styles/policy.module.scss';

function plainText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? plainText(child.props.children)
        : String(child),
    )
    .join('');
}
function headingId(children: ReactNode) {
  return plainText(children)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}
function policyHref(href?: string) {
  if (!href) return undefined;
  const match = href.match(/^(?:https:\/\/vocespace\.com)?\/(?:legal\/)?(privacy|terms)\/?(#.*)?$/);
  return (match ? `/policy/${match[1]}${match[2] || ''}` : href)
    .replace(/#delete-account$/, '#10-deleting-your-vocespace-account')
    .replace(/#ai$/, '#4-ai-worklogs');
}
export function LegalReader({ markdown }: { markdown: string }) {
  const { t } = useI18n();
  return (
    <div className={styles.reader}>
      <header>
        <Link href="/">{t('account.home')}</Link>
        <PolicyLinks />
      </header>
      <article>
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h1 id={headingId(children)}>{children}</h1>,
            h2: ({ children }) => <h2 id={headingId(children)}>{children}</h2>,
            h3: ({ children }) => <h3 id={headingId(children)}>{children}</h3>,
            a: ({ href, children }) => {
              const target = policyHref(href);
              const external = target?.startsWith('https://') || target?.startsWith('http://');
              return (
                <a
                  href={target}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noopener noreferrer' : undefined}
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {markdown}
        </Markdown>
      </article>
    </div>
  );
}
