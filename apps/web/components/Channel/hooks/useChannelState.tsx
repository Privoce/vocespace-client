'use client';

import { ChannelExports, ChannelProps, RoomPrivacy } from '@/components/Channel/types';
import { exportRBAC } from '@/lib/hooks/platform';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { useI18n } from '@/lib/i18n/i18n';
import { WsSender } from '@/lib/std/device';
import { ChildRoom } from '@/lib/std/space';
import { useSpaceStore } from '@/lib/store';
import { theme } from 'antd';
import { CheckboxGroupProps } from 'antd/es/checkbox';
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
export function useChannelState(
  {
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
  }: ChannelProps,
  ref: React.ForwardedRef<ChannelExports>,
) {
  const device = useLayoutDevice();
  const { t } = useI18n();
  const collapsed = useSpaceStore((s) => s.collapsed);
  const setCollapsed = useSpaceStore((s) => s.setCollapsed);
  const isFullScreen = useSpaceStore((s) => s.isFullScreen);
  const { token } = theme.useToken();
  const [selected, setSelected] = useState<'main' | 'sub'>('main');
  const [roomCreateModalOpen, setRoomCreateModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ChildRoom | null>(null);
  const [mainJoinVis, setMainJoinVis] = useState<'hidden' | 'visible'>('hidden');
  const [roomJoinVis, setRoomJoinVis] = useState<number | null>(null);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [shareRoomOpen, setShareRoomOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [renameRoomName, setRenameRoomName] = useState('');
  const [joinParticipant, setJoinParticipant] = useState<{
    id: string;
    name: string;
    targetRoom: string;
  } | null>(null);
  const [selfRoomName, setSelfRoomName] = useState<string>(space.name);
  const [subActiveKey, setSubActiveKey] = useState<string[]>([]);
  const [subRoomsTmp, setSubRoomsTmp] = useState<string[]>([]);
  const [mainActiveKey, setMainActiveKey] = useState<string[]>(['main', 'sub']);
  const [roomPrivacy, setRoomPrivacy] = useState<RoomPrivacy>('public');
  const { createRoom, manageRoom } = useMemo(() => {
    return exportRBAC(localParticipantId, settings);
  }, [localParticipantId, settings]);
  const roomPrivacyOptions: CheckboxGroupProps<string>['options'] = [
    {
      label: t('channel.modal.privacy.public.title'),
      value: 'public',
    },
    {
      label: t('channel.modal.privacy.private.title'),
      value: 'private',
    },
  ];
  const isMobile = device === 'phone';
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mainHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    // 设置默认展开的子房间的Collapse body基于subRoomsTmp
    let currentRooms = settings.children.map((room) => room.name);
    let isSameAsSubTmp =
      subRoomsTmp.length > 0 ? subRoomsTmp.every((room) => currentRooms.includes(room)) : false;
    if (settings.children.length > 0 && !isSameAsSubTmp) {
      let newRooms: string[] = [];
      // 同时如果子房间是公开的，默认展开
      for (const child of settings.children) {
        newRooms.push(child.name);
        if (!child.isPrivate) {
          setSubActiveKey((prev) => [...prev, child.name]);
          continue;
        }
        if (!subRoomsTmp.includes(child.name) && child.participants.length > 0) {
          setSubActiveKey((prev) => [...prev, child.name]);
          continue;
        }
        // 如果当前这个本地用户在子房间中，需要展开这个子房间
        if (child.participants.includes(localParticipantId)) {
          setSubActiveKey((prev) => [...prev, child.name]);
          continue;
        }
      }
      setSubRoomsTmp(newRooms);
    }
  }, [settings.children, localParticipantId, subRoomsTmp]);
  const allParticipants = useMemo(() => {
    // return Object.keys(settings.participants);
    // 只返回在线的参与者
    return Object.entries(settings.participants)
      .filter(([_, p]) => {
        return p.online;
      })
      .map(([pid, _]) => pid);
  }, [settings]);
  const wsSender = useMemo(() => {
    if (settings && space.name && localParticipantId && settings.participants[localParticipantId]) {
      const senderName = settings.participants[localParticipantId].name;
      return {
        space: space.name,
        senderName,
        senderId: localParticipantId,
      } as WsSender;
    } else {
      return null;
    }
  }, [space.name, localParticipantId, settings]);
  return {
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
    ref,
    t,
    collapsed,
    setCollapsed,
    isFullScreen,
    token,
    selected,
    setSelected,
    roomCreateModalOpen,
    setRoomCreateModalOpen,
    selectedRoom,
    setSelectedRoom,
    mainJoinVis,
    setMainJoinVis,
    roomJoinVis,
    setRoomJoinVis,
    joinModalOpen,
    setJoinModalOpen,
    renameModalOpen,
    setRenameModalOpen,
    shareRoomOpen,
    setShareRoomOpen,
    feedbackOpen,
    setFeedbackOpen,
    renameRoomName,
    setRenameRoomName,
    joinParticipant,
    setJoinParticipant,
    selfRoomName,
    setSelfRoomName,
    subActiveKey,
    setSubActiveKey,
    subRoomsTmp,
    setSubRoomsTmp,
    mainActiveKey,
    setMainActiveKey,
    roomPrivacy,
    setRoomPrivacy,
    createRoom,
    manageRoom,
    roomPrivacyOptions,
    isMobile,
    hideTimeoutRef,
    mainHideTimeoutRef,
    allParticipants,
    wsSender,
    device,
  };
}
