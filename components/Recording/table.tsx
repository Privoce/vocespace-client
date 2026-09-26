'use client';
import * as React from 'react';
import { useRecordingActions } from '@/components/Recording/hooks/useRecordingActions';
import { RecordingTablePC } from './table/pc';
import { RecordingTablePhone } from './table/phone';
import { RecordingTableProps } from './types';
export * from './types';

export function RecordingTable(props: RecordingTableProps) {
  const model = useRecordingActions(props);
  return model.device === 'phone' ? (
    <RecordingTablePhone model={model} />
  ) : (
    <RecordingTablePC model={model} />
  );
}
