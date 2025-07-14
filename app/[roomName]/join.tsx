import { useI18n } from '@/lib/i18n/i18n';
import { Skeleton } from 'antd';
import { Suspense, useEffect, useState } from 'react';
import styles from '@/styles/Home.module.css';
import { LangSelect } from '../pages/controls/lang_select';
import { SvgResource } from '../resources/svg';
import { LocalUserChoices } from '@livekit/components-react';
import { DemoMeetingTab } from '../pages/pre_join/demo';
import { connect_endpoint } from '@/lib/std';
import api from '@/lib/api';

const CONNECT_ENDPOINT = connect_endpoint('/api/env');

export default function JoinRoom({ onSubmit }: { onSubmit: (values: LocalUserChoices) => void }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');

  const getHostToken = async () => {
    const { host_token } = await api.envConf();
    setToken(host_token);
    setLoading(false);
  };

  useEffect(() => {
    if (token === '') {
      getHostToken();
    }
  }, [token]);
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
              {/* <SvgResource type="logo2" svgSize={45}></SvgResource> */}
            </div>
            <h2>LOGO</h2>
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
            <DemoMeetingTab onSubmit={onSubmit} hostToken={token} />
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
        <footer data-lk-theme="default">FOOTER</footer>
      )}
    </>
  );
}
