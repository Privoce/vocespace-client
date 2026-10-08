'use client';

import { api } from '@/lib/api';
import { UpdateRoomParam, UpdateRoomType } from '@/lib/api/channel';
import { audio } from '@/lib/audio';
import { socket } from '@/lib/realtime/socket';
import { createSocketScope } from '@/lib/realtime/socket-scope';
import {
  encodeChildRoomEnter
} from '@/lib/std';
import { WsJoinRoom, WsRemove } from '@/lib/std/device';
import { ChildRoom } from '@/lib/std/space';
import {
  MenuProps
} from 'antd';
import * as React from 'react';
import {
  useCallback, useEffect,
  useMemo,
  useState
} from 'react';
import type { useChannelState } from './useChannelState';

export function useChannelRooms(context: ReturnType<typeof useChannelState>) {
  const {
    space,
    config,
    settings,
    messageApi,
    localParticipantId,
    onUpdate,
    t,
    collapsed,
    setCollapsed,
    selected,
    setRoomCreateModalOpen,
    selectedRoom,
    setSelectedRoom,
    joinModalOpen,
    setJoinModalOpen,
    setRenameModalOpen,
    setShareRoomOpen,
    renameRoomName,
    setRenameRoomName,
    joinParticipant,
    setJoinParticipant,
    selfRoomName,
    setSelfRoomName,
    subActiveKey,
    setSubActiveKey,
    setMainActiveKey,
    roomPrivacy,
    createRoom,
    manageRoom,
    hideTimeoutRef,
    mainHideTimeoutRef,
    wsSender,
  } = context;
  const agreeJoinRoom = useCallback(async (room: string) => {
    setSelfRoomName(room);
    setSubActiveKey((prev) => {
      const newSubActiveKey = [...prev];
      if (!prev.includes(room)) {
        newSubActiveKey.push(room);
      }
      return newSubActiveKey;
    });
    // setMainActiveKey(['sub']);
    await onUpdate();
    messageApi.success({
      content: t('channel.join.success'),
      duration: 2,
    });
  }, [setSelfRoomName, setSubActiveKey, onUpdate, messageApi, t]);
  useEffect(() => {
    const events = createSocketScope(socket);
    // 监听加入私密房间的socket事件 --------------------------------------------------------------------------
    events.on('join_privacy_room_response', async (msg: WsJoinRoom) => {
      if (msg.space === space.name && msg.receiverId === localParticipantId) {
        if (!joinModalOpen) {
          if (msg.confirm === false) {
            // 说明对方拒绝了加入请求
            messageApi.warning({
              content: t('channel.modal.join.reject'),
            });
            setJoinModalOpen(false);
          } else if (msg.confirm) {
            //同意加入
            agreeJoinRoom(msg.childRoom);
          } else {
            await audio.wave();
            setJoinParticipant({
              id: msg.senderId,
              name: msg.senderName,
              targetRoom: msg.childRoom,
            });
            setJoinModalOpen(true);
          }
        }
      }
    });
    // 监听从私密房间移除的socket事件 -----------------------------------------------------------------------
    events.on('removed_from_privacy_room_response', (msg: WsRemove) => {
      if (msg.space === space.name && msg.participants.includes(localParticipantId)) {
        messageApi.info({
          content: `${t('channel.modal.remove.before')}${msg.childRoom}${t(
            'channel.modal.remove.after',
          )}`,
        });
      }
    });

    return () => {
      events.dispose();
    };
  }, [space.name, localParticipantId, joinModalOpen, agreeJoinRoom, messageApi, setJoinModalOpen, setJoinParticipant, t]);
  useEffect(() => {
    const hoverTimer = hideTimeoutRef;
    const mainHoverTimer = mainHideTimeoutRef;
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (mainHoverTimer.current) clearTimeout(mainHoverTimer.current);
    };
  }, [hideTimeoutRef, mainHideTimeoutRef]);
  const childRooms = useMemo(() => {
    return settings.children || [];
  }, [settings.children]);
  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };
  const [childRoomName, setChildRoomName] = useState('');
  const createChildRoom = async () => {
    if (childRoomName.trim() === '') {
      messageApi.error({
        content: t('channel.create.empty_name'),
        duration: 2,
      });
      return;
    }

    const response = await api.createRoom({
      spaceName: space.name,
      roomName: childRoomName,
      ownerId: localParticipantId,
      isPrivate: roomPrivacy === 'private',
    });

    if (!response.ok) {
      messageApi.error({
        content: t('channel.create.error'),
        duration: 2,
      });
      return;
    } else {
      messageApi.success({
        content: t('channel.create.success'),
        duration: 2,
      });
      setRoomCreateModalOpen(false);
    }
    await onUpdate();
  };
  const deleteChildRoom = async () => {
    if (!selectedRoom) return;

    if (selectedRoom.participants.length > 0) {
      let socketIds = selectedRoom.participants.map((pid) => {
        return settings.participants[pid].socketId;
      });

      // socket通知用户移除
      socket.emit('removed_from_privacy_room', {
        space: space.name,
        participants: selectedRoom.participants,
        socketIds,
        childRoom: selectedRoom.name,
      } as WsRemove);
    }

    const response = await api.deleteRoom({
      spaceName: space.name,
      roomName: selectedRoom.name,
    });

    if (!response.ok) {
      messageApi.error({
        content: t('channel.delete.error'),
        duration: 2,
      });
      return;
    } else {
      setSelectedRoom(null);
      await onUpdate();
      messageApi.success({
        content: t('channel.delete.success'),
        duration: 2,
      });
    }
  };
  const leaveChildRoom = async (room?: string) => {
    if (!selectedRoom && !room) return;

    const response = await api.leaveRoom({
      spaceName: space.name,
      roomName: room || selectedRoom!.name,
      participantId: localParticipantId,
    });

    if (!response.ok) {
      const { error } = await response.json();
      messageApi.error({
        content: error,
        duration: 2,
      });
    } else {
      setSelfRoomName(space.name);
      // setMainActiveKey(['main', 'sub']);
      setSubActiveKey([]);
      setSelectedRoom(null);
      await onUpdate();
      messageApi.success({
        content: t('channel.leave.success'),
        duration: 2,
      });
    }
  };
  const joinChildRoom = async (room: ChildRoom, participantId: string) => {
    const response = await api.joinRoom({
      spaceName: space.name,
      roomName: room.name,
      participantId,
    });

    if (!response.ok) {
      const { error } = await response.json();
      messageApi.error({
        content: error,
        duration: 2,
      });
      return;
    } else {
      // 进入子房间后 subActiveKey 就是当前子房间的key
      await agreeJoinRoom(room.name);
    }
  };
  const addIntoRoom = async (room: ChildRoom) => {
    // 判断是否为私密房间，如果是则需要使用socket通知拥有者
    if (room.isPrivate && room.ownerId !== localParticipantId) {
      // 只有当前房间的拥有者在Space中才能发送这个请求
      if (settings.participants[room.ownerId]) {
        socket.emit('join_privacy_room', {
          receiverId: room.ownerId,
          socketId: settings.participants[room.ownerId].socketId,
          childRoom: room.name,
          ...wsSender
        } as WsJoinRoom);
      } else {
        messageApi.warning(t('channel.modal.join.missing_owner'));
      }

      return;
    }
    await joinChildRoom(room, localParticipantId);
  };
  const confirmJoinRoom = async (confirm: boolean) => {
    if (!joinParticipant) {
      messageApi.error({
        content: t('channel.modal.join.missing_data'),
      });
      return;
    }
    if (confirm) {
      // 同意加入
      const childRoom = settings.children.find((c) => c.name === joinParticipant?.targetRoom);
      if (childRoom) {
        await joinChildRoom(childRoom, joinParticipant.id);
      } else {
        messageApi.error({
          content: t('channel.modal.join.missing_data'),
        });
      }
    }
    socket.emit('join_privacy_room', {
      receiverId: joinParticipant.id,
      socketId: settings.participants[joinParticipant.id].socketId,
      childRoom: joinParticipant.targetRoom,
      confirm,
      ...wsSender
    } as WsJoinRoom);
    setJoinParticipant(null);
    setJoinModalOpen(false);
  };
  const joinMainRoom = async () => {
    // 设置为当前自己所在的房间
    console.warn('selfRoomName', selfRoomName);
    await leaveChildRoom(selfRoomName);
  };
  const updateChildRoom = async (ty: UpdateRoomType) => {
    if (!selectedRoom) return;
    let isRename = ty === 'name';
    let param = {
      ty,
      spaceName: space.name,
      roomName: selectedRoom.name,
    } as UpdateRoomParam;
    if (isRename) {
      if (renameRoomName.trim() === '') {
        messageApi.error({
          content: t('channel.modal.rename.empty_name'),
        });
        return;
      }

      if (settings.children.some((room) => room.name === renameRoomName.trim())) {
        messageApi.error({
          content: t('channel.modal.rename.repeat'),
        });
        return;
      }
      setRenameModalOpen(false);
      param.newRoomName = renameRoomName.trim();
      setRenameRoomName('');
    } else {
      // 切换隐私性
      param.isPrivate = !selectedRoom.isPrivate;
    }

    const response = await api.updateRoom(param);

    if (response.ok) {
      await onUpdate();
      messageApi.success({
        content: isRename
          ? t('channel.modal.rename.success')
          : `${t('channel.modal.privacy.success')}: ${param.isPrivate
            ? t('channel.modal.privacy.private.title')
            : t('channel.modal.privacy.public.title')
          }`,
      });
    }
  };
  const authDisabled = useMemo(() => {
    if (localParticipantId === settings.ownerId) {
      return false;
    } else {
      return selectedRoom?.ownerId !== localParticipantId ? true : !manageRoom;
    }
  }, [settings.ownerId, selectedRoom, localParticipantId, manageRoom]);
  const subContextItems: MenuProps['items'] = [
    {
      key: 'rename',
      label: t('channel.menu.rename'),
      disabled: authDisabled,
      onClick: () => {
        console.warn('rename', selectedRoom);
        setRenameModalOpen(true);
      },
    },
    {
      key: 'share',
      label: t('channel.menu.share'),
      disabled: authDisabled,

      onClick: () => {
        setShareRoomOpen(true);
      },
    },
    {
      key: 'privacy',
      label: `${t('channel.menu.switch_privacy')}${!selectedRoom?.isPrivate
        ? t('channel.modal.privacy.private.title')
        : t('channel.modal.privacy.public.title')
        }`,
      disabled: authDisabled,
      onClick: async () => updateChildRoom('privacy'),
    },
    {
      key: 'delete',
      label: t('channel.menu.delete'),
      onClick: deleteChildRoom,
      disabled: authDisabled,
    },
    {
      key: 'leave',
      label: t('channel.menu.leave'),
      disabled: selfRoomName !== selectedRoom?.name,
      onClick: async () => await leaveChildRoom(),
    },
  ];
  const panelStyle: React.CSSProperties = {
    marginBottom: 0,
    background: '#1e1e1e',
    borderRadius: 0,
    border: 'none',
    padding: '0px',
  };
  const subStyle: React.CSSProperties = {
    marginBottom: 0,
    background: selected == 'sub' ? '#2a2a2a' : '#1e1e1e',
    borderRadius: 0,
    border: 'none',
  };
  const shareRoomToClipboard = (room?: string, spaceName?: string) => {
    let targetRoom = room ?? selectedRoom?.name;
    let targetSpace = spaceName ?? space.name;
    if (!targetRoom || !targetSpace) {
      return;
    }
    // 复制到剪贴板
    navigator.clipboard.writeText(
      `https://${config.serverUrl}/${targetSpace}?childRoomEnter=${encodeChildRoomEnter(
        targetSpace,
        targetRoom,
        space.localParticipant.identity,
      )}`,
    );
    messageApi.success({
      content: t('common.copy.success'),
    });
  };
  return {
    ...context,
    agreeJoinRoom,
    childRooms,
    toggleCollapse,
    childRoomName,
    setChildRoomName,
    createChildRoom,
    deleteChildRoom,
    leaveChildRoom,
    joinChildRoom,
    addIntoRoom,
    confirmJoinRoom,
    joinMainRoom,
    updateChildRoom,
    authDisabled,
    subContextItems,
    panelStyle,
    subStyle,
    shareRoomToClipboard,
  };
}
