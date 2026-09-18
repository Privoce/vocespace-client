'use client';
import * as React from 'react';
import { useRecordings } from '@/features/recording/hooks/useRecordings';
import { RecordingContentPC } from '@/features/recording/views/pc';
import { RecordingContentPhone } from '@/features/recording/views/phone';
import { RecordingContentProps } from '@/features/recording/shared';
export * from '@/features/recording/shared';
export function RecordingContent(props: RecordingContentProps) {
const model = useRecordings(props);
return model.device === 'phone' ? <RecordingContentPhone model={model} /> : <RecordingContentPC model={model} />;
}
