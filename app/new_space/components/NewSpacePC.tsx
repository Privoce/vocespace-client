'use client';

import { LangSelect } from '@/app/pages/controls/selects/lang_select';
import { SvgResource } from '@/app/resources/svg';
import styles from '../index.module.scss';
import { Skeleton } from 'antd';
import type { NewSpaceModel } from '../hooks/UseNewSpace';
import { MeetingSection } from './MeetingSection';

export function NewSpacePC({ t, loading, meeting }: NewSpaceModel) {
  if (loading) {
    return (
      <main className={styles.main} data-lk-theme="default">
        <span className={styles.lang_select}>
          <Skeleton.Node
            active
            style={{ height: `40px`, backgroundColor: '#333', width: '126px' }}
          ></Skeleton.Node>
        </span>
        <div className={styles.header} style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}>
          <Skeleton.Node
            active
            style={{ height: `40px`, backgroundColor: '#333', width: '240px', marginBottom: 8 }}
          ></Skeleton.Node>
          <Skeleton.Node
            active
            style={{ height: `36px`, backgroundColor: '#333', width: '360px' }}
          ></Skeleton.Node>
        </div>

        <div className={styles.tabContent}>
          <Skeleton.Node
            active
            style={{ height: `200px`, backgroundColor: '#333', width: '100%' }}
          ></Skeleton.Node>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className={styles.main} data-lk-theme="default">
        <span className={styles.lang_select}>
          <LangSelect></LangSelect>
        </span>

        <div className={styles.header}>
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

        <MeetingSection model={meeting}></MeetingSection>
      </main>
    </>
  );
}
