import { useI18n } from '@/lib/i18n/i18n';
import { Skeleton } from 'antd';
import { Suspense, useEffect, useState } from 'react';
import styles from '@/styles/Home.module.css';
import { LangSelect } from '../pages/controls/lang_select';
import { SvgResource } from '../resources/svg';
import { LocalUserChoices } from '@livekit/components-react';
import { DemoMeetingTab } from '../pages/pre_join/demo';

export default function JoinRoom({ onSubmit }: { onSubmit: (values: LocalUserChoices) => void }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 400);
  }, []);
  return (
    <>
      <main className={styles.main} data-lk-theme="default">
        <span className={styles.lang_select}>
          {loading ? (
            <Skeleton.Node
              active
              style={{ height: `40px`, backgroundColor: '#333', width: '126px' }}
            ></Skeleton.Node>
          ) : (
            <LangSelect></LangSelect>
          )}
        </span>
        {loading ? (
          <div className={styles.flex_column}>
            <Skeleton.Node
              active
              style={{ height: `45px`, backgroundColor: '#333', width: '240px' }}
            ></Skeleton.Node>
            <Skeleton.Node
              active
              style={{ height: `36px`, backgroundColor: '#333', width: '360px' }}
            ></Skeleton.Node>
          </div>
        ) : (
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
        )}
        {/* main tab for room enter ------------------------------------------------------------ */}
        {loading ? (
          <div className={styles.flex_column}>
            <Skeleton.Node
              active
              style={{ height: `200px`, backgroundColor: '#333', width: '400px' }}
            ></Skeleton.Node>
          </div>
        ) : (
          <Suspense fallback="Loading">
            <DemoMeetingTab onSubmit={onSubmit} />
          </Suspense>
        )}
      </main>
      {/* footer for connect ------------------------------------------------------------------- */}
      {loading ? (
        <Skeleton.Node
          active
          style={{ height: `67px`, backgroundColor: '#333', width: '100%' }}
        ></Skeleton.Node>
      ) : (
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
      )}
    </>
  );
}
