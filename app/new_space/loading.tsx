'use client';

import React from 'react';
import { Skeleton } from 'antd';
import styles from '@/styles/Home.module.css';

export default function PageLoading() {
  return (
    <>
      <main className={styles.main} data-lk-theme="default">
        <span className={styles.lang_select}>
          <Skeleton.Node
            active
            style={{ height: '40px', backgroundColor: '#333', width: '126px' }}
          ></Skeleton.Node>
        </span>

        <div className={styles.flex_column}>
          <Skeleton.Node
            active
            style={{ height: '45px', backgroundColor: '#333', width: '240px' }}
          ></Skeleton.Node>
          <Skeleton.Node
            active
            style={{ height: '36px', backgroundColor: '#333', width: '360px' }}
          ></Skeleton.Node>
        </div>

        <div className={styles.flex_column}>
          <Skeleton.Node
            active
            style={{ height: '200px', backgroundColor: '#333', width: '400px' }}
          ></Skeleton.Node>
        </div>
      </main>

      <Skeleton.Node
        active
        style={{ height: '67px', backgroundColor: '#333', width: '100%' }}
      ></Skeleton.Node>
    </>
  );
};

