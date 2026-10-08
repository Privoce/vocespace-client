'use client';
import * as React from 'react';
import { useRecordings } from '@/components/Recording/hooks/useRecordings';
import { RecordingContentPC } from '@/components/Recording/content/pc';
import { RecordingContentPhone } from '@/components/Recording/content/phone';
import { RecordingContentProps } from '@/components/Recording/types';
export * from '@/components/Recording/types';
export function RecordingContent(props: RecordingContentProps) {
  const model = useRecordings(props);
  return model.device === 'phone' ? (
    <RecordingContentPhone model={model} />
  ) : (
    <RecordingContentPC model={model} />
  );
}
