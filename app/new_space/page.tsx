'use client';

import React, { Suspense, useEffect } from 'react';
import styles from '@/styles/Home.module.css';
import { useI18n } from '@/lib/i18n/i18n';
import { MeetingTab } from '../pages/pre_join/tab';
import { LangSelect } from '@/components/selects/lang';
import { SvgResource } from '../resources/svg';
import PageLoading from './loading';

export default function Page() {
  const { t } = useI18n();
  const [loading, setLoading] = React.useState(true);
  const [hq, setHq] = React.useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(false);
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  if (loading) {
    return <PageLoading />;
  }

  return (
    <>
      <main className={styles.main} data-lk-theme="default">
        <span className={styles.lang_select}>
          <LangSelect></LangSelect>
        </span>
        <div className="header">
          <div
            style={{
              marginBottom: '12px',
              width: '100%',
              display: 'inline-flex',
              justifyContent: 'center',
            }}
          >
            <SvgResource type="logo2" svgSize={45}></SvgResource>
          </div>
          <h2>{t('msg.info.title')}</h2>
        </div>
        {/* main tab for room enter ------------------------------------------------------------ */}
        <Suspense fallback="Loading">
          <MeetingTab hq={hq} setHq={setHq} />
        </Suspense>
      </main>
      {/* footer for connect ------------------------------------------------------------------- */}
      <footer data-lk-theme="default">
        {t('msg.info.contact')}
        <a
          href="mailto:han@privoce.com"
          style={{ color: '#22CCEE', textDecorationLine: 'none', margin: '0 4px' }}
        >
          han@privoce.com
        </a>
        {t('msg.info.learn_more')}:{' '}
        <a
          href="https://vocespace.com"
          style={{ color: '#22CCEE', textDecorationLine: 'none', margin: '0 4px' }}
        >
          {t('msg.info.offical_web')}
        </a>
      </footer>
    </>
  );
}
