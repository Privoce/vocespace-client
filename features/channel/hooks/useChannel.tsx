'use client';

import { ChannelExports, ChannelProps } from '@/features/channel/shared';
import * as React from 'react';
import { useChannelActions } from './useChannelActions';
import { useChannelFeedback } from './useChannelFeedback';
import { useChannelRooms } from './useChannelRooms';
import { useChannelState } from './useChannelState';
export function useChannel({
  space,
  config,
  settings,
  messageApi,
  localParticipantId,
  onUpdate,
  tracks,
  isActive = false,
  updateSettings,
  toRenameSettings,
  toSettings,
  setUserStatus,
  showFlotApp,
}: ChannelProps, ref: React.ForwardedRef<ChannelExports>) {
  const part0 = useChannelState({
    space,
    config,
    settings,
    messageApi,
    localParticipantId,
    onUpdate,
    tracks,
    isActive,
    updateSettings,
    toRenameSettings,
    toSettings,
    setUserStatus,
    showFlotApp,
  }, ref);
  const part1 = useChannelRooms(part0);
  const part2 = useChannelFeedback(part1);
  const part3 = useChannelActions(part2);
  return part3;
}
