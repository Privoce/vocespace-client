'use client';

import { VideoContainerExports, VideoContainerProps } from '@/features/conference/shared';
import React from 'react';
import { useConferenceEvents } from './useConferenceEvents';
import { useConferenceLayout } from './useConferenceLayout';
import { useConferenceMedia } from './useConferenceMedia';
import { useConferenceMembership } from './useConferenceMembership';
import { useConferenceState } from './useConferenceState';
export function useConference({
  chatMessageFormatter,
  chatMessageDecoder,
  chatMessageEncoder,
  SettingsComponent,
  noteApi,
  messageApi,
  setPermissionDevice,
  config,
  ...props
}: VideoContainerProps, ref: React.ForwardedRef<VideoContainerExports>) {
  const part0 = useConferenceState({
    chatMessageFormatter,
    chatMessageDecoder,
    chatMessageEncoder,
    SettingsComponent,
    noteApi,
    messageApi,
    setPermissionDevice,
    config,
    ...props
  }, ref);
  const part1 = useConferenceEvents(part0);
  const part2 = useConferenceMembership(part1);
  const part3 = useConferenceMedia(part2);
  const part4 = useConferenceLayout(part3);
  return part4;
}
