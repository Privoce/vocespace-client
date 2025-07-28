'use client';

import { Skeleton } from 'antd';
import { Suspense, useEffect, useState } from 'react';
import styles from '@/styles/Home.module.css';
import { LangSelect } from '../pages/controls/lang_select';
import { LocalUserChoices } from '@livekit/components-react';
import { DemoMeetingTab } from '../pages/pre_join/demo';
import api from '@/lib/api';
import { Role } from '@/lib/std';
import { MessageInstance } from 'antd/es/message/interface';
import { SvgResource } from '../resources/svg';

export interface JoinRoomProps {
  onSubmit: (values: LocalUserChoices) => void;
  role: Role;
  setRole: (role: Role) => void;
  messageApi: MessageInstance;
}

export function JoinRoom({ onSubmit, role, setRole, messageApi }: JoinRoomProps) {
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
                alignItems: 'center',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <SvgResource type="SG_logo" svgSize={200} color="#fff"></SvgResource>
              <span style={{ color: '#fff', fontSize: '24px', fontWeight: 700, letterSpacing: 2 }}>
                SHANGHAI GENTING
              </span>
            </div>
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
            <DemoMeetingTab
              onSubmit={onSubmit}
              hostToken={token}
              role={role}
              setRole={setRole}
              messageApi={messageApi}
            />
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
        <footer data-lk-theme="default"></footer>
      )}
    </>
  );
}
