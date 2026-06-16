'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { Spin } from 'antd';
import { useSearchParams } from 'next/navigation';
import { RecordingContent } from './content';
import { RecordState, useRecordingEnv } from '@/lib/std/recording';
import { message } from 'antd';

function RecordsPageContent() {
  const searchParams = useSearchParams();
  const [initialRoom, setInitialRoom] = useState<string | undefined>();
  const [autoSearchRoom, setAutoSearchRoom] = useState<string | undefined>();
  const [messageApi, contextHolder] = message.useMessage();
  const { state } = useRecordingEnv(messageApi);

  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam) {
      setInitialRoom(roomParam);
    }
  }, [searchParams]);

  // 当 S3 连接成功且有初始房间时，触发自动搜索
  const onAutoSearch = useCallback(() => {
    if (initialRoom && state === RecordState.Connected) {
      setAutoSearchRoom(initialRoom);
    }
  }, [initialRoom, state]);

  useEffect(() => {
    onAutoSearch();
  }, [onAutoSearch]);

  return (
    <>
      {contextHolder}
      <RecordingContent showContainer={true} initialRoom={initialRoom} autoSearchRoom={autoSearchRoom} />
    </>
  );
}

function RecordsPageFallback() {
  return (
    <div style={{ padding: 24, background: '#000', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', marginTop: '20%' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#fff' }}>loading...</div>
      </div>
    </div>
  );
}

export default function RecordsPage() {
  return (
    <Suspense fallback={<RecordsPageFallback />}>
      <RecordsPageContent />
    </Suspense>
  );
}
