'use client';

import { useMeeting, type MeetingTabProps } from '@/features/home/hooks/use-meeting';
import { MeetingTabView } from '@/features/home/views/meeting-tab';
export type { MeetingTabProps } from '@/features/home/hooks/use-meeting';

export function MeetingTab(props: MeetingTabProps) {
  const model = useMeeting(props);
  return <MeetingTabView model={model} />;
}
