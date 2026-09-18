'use client';
import * as React from 'react';
import { useRecordingActions } from '@/features/recording-list/hooks/useRecordingActions';
import { RecordingTablePC } from '@/features/recording-list/views/pc';
import { RecordingTablePhone } from '@/features/recording-list/views/phone';
import { RecordingTableProps } from '@/features/recording-list/shared';
export * from '@/features/recording-list/shared';
export function RecordingTable(props: RecordingTableProps) {
const model = useRecordingActions(props);
return model.device === 'phone' ? <RecordingTablePhone model={model} /> : <RecordingTablePC model={model} />;
}
