'use client';

import React, { Suspense } from 'react';
import { Spin } from 'antd';
import { useSearchParams } from 'next/navigation';
import { RecordingContent } from './content';

function RecordsPageContent() {
  const room = useSearchParams().get('room') || undefined;
  return <RecordingContent showContainer initialRoom={room} autoSearchRoom={room}/>;
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
