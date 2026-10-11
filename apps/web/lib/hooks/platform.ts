'use client';

/**
 * 获取从home.vocespace.com提供的平台信息到localStorage的hook
 * 该hook只允许使用者获取数据，不允许修改数据
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_RBAC_CONF,
  DEFAULT_SPACE_AUTH_CONF,
  handleIdentityType,
  ParticipantSettings,
  SpaceAuthConf,
  SpaceAuthRBAC,
  SpaceInfo,
  SpaceRBACConf,
  VOCESPACE_PLATFORM_USER,
} from '@/lib/std/space';
import {
  AuthType,
  TokenResult,
  SearchParams,
  PlatformUser,
  verifyPlatformUser,
  isSpaceManager,
  IdentityType,
} from '@/lib/std/index';
import equal from 'fast-deep-equal';
import { ConnectionDetails } from '@/lib/types';
import { MessageInstance } from 'antd/es/message/interface';
import { useI18n } from '@/lib/i18n/i18n';
import { api } from '@/lib/api/index';
import { socket } from '@/lib/realtime/socket';
import { getWebClient, exchangePlatformCode } from '@/lib/api/client';
import { Room } from 'livekit-client';

export interface UsePlatformUserProps {
  searchParams: SearchParams;
  messageApi: MessageInstance;
}

/**
 * 解析来自某个平台的Token得到需要的信息，返回TokenResult
 * @param token
 */

/**
 * 用于在客户端中处理来自平台并存储在localStorage中的用户信息的hook
 * 目的是在进入空间前就处理好平台用户信息，避免在空间内再进行处理
 */
export function usePlatformUser({ searchParams, messageApi }: UsePlatformUserProps) {
  const { t } = useI18n();
  const [platformUser, setPlatformUser] = useState<PlatformUser | undefined>(undefined);
  const [details, setDetails] = useState<ConnectionDetails | undefined>(undefined);
  const [isValid, setIsValid] = useState<boolean>(false);

  const castToPlatformUser = (data: string | TokenResult, auth: AuthType): PlatformUser => {
    const tokenRes = typeof data === 'string' ? JSON.parse(decodeURIComponent(data)) : data;
    return {
      auth,
      ...tokenRes,
    };
  };

  const castToConnectionDetails = (data: string | ConnectionDetails): ConnectionDetails => {
    return typeof data === 'string' ? JSON.parse(decodeURIComponent(data)) : data;
  };

  // 通过/api/connection-details进行身份接入的用户这个api都会返回携带auth和data参数
  const checkOrUpdateStore = async () => {
    if (typeof window === 'undefined') return;
    const client = getWebClient();
    const code = searchParams.code || new URL(window.location.href).searchParams.get('code');
    const response = code ? await exchangePlatformCode(code) : await client.session.get();
    if (!response.ok) { localStorage.removeItem(VOCESPACE_PLATFORM_USER); return; }
    const { platform } = await response.json();
    if (code) {
      if (socket.connected) { socket.disconnect(); socket.connect(); }
      const url = new URL(window.location.href);
      for (const key of ['code', 'data', 'details', 'token']) url.searchParams.delete(key);
      window.history.replaceState({}, '', url);
    }
    if (!platform || !verifyPlatformUser(platform)) { localStorage.removeItem(VOCESPACE_PLATFORM_USER); return; }
    localStorage.setItem(VOCESPACE_PLATFORM_USER, JSON.stringify(platform));
    setPlatformUser(platform);
    if (code) {
      const connection = await client.connections.get({ spaceName: platform.space, participantName: platform.username });
      setDetails(connection);
      setIsValid(true);
    }
  };

  return {
    checkOrUpdateStore,
    castToPlatformUser,
    platformUser,
    details,
    /**
     * 数据是否有效, 如果无效则不能使用platformUser和details
     */
    isValid,
  };
}

export const exportRBAC = (uid: string, spaceInfo?: SpaceInfo): SpaceRBACConf => {
  if (!spaceInfo) {
    return DEFAULT_SPACE_AUTH_CONF.guest;
  }

  const targetParticipant = spaceInfo.participants[uid];

  if (!targetParticipant) {
    return DEFAULT_SPACE_AUTH_CONF.guest;
  }
  const identity = handleIdentityType(
    (targetParticipant?.auth?.identity || 'guest') as IdentityType,
  );

  return spaceInfo.auth[identity] || DEFAULT_SPACE_AUTH_CONF.guest;
};

/**
 * 这个hook只需要从localStorage中获取平台用户信息来处理数据
 * 常用在需要根据平台用户信息来决定一些UI显示与否的场景，这是一个纯客户端hook
 * @param param0
 */
export const usePlatformUserInfo = ({
  space,
  onEnterRoom,
  uid,
}: {
  space?: Room;
  uid?: string;
  onEnterRoom?: () => void;
}) => {
  const platUser: PlatformUser | null = useMemo(() => {
    if (!uid) return null;
    if (!space) return null;
    if (typeof window === 'undefined') return null;
    const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER);
    if (storedUserInfo) {
      const parsedInfo = JSON.parse(storedUserInfo) as PlatformUser;
      return parsedInfo.id === uid ? parsedInfo : null;
    } else {
      return null;
    }
  }, [uid, space]);

  const { fromVocespace, auth, showSideChannel, showAI } = useMemo(() => {
    if (!platUser || !uid || !space) {
      return {
        fromVocespace: false,
        auth: 'other',
        showSideChannel: false,
        showAI: false,
        ...DEFAULT_RBAC_CONF('guest'),
      };
    }

    const identity = handleIdentityType(platUser.identity);
    return {
      fromVocespace: platUser.auth === 'vocespace',
      auth: platUser.auth || 'other',
      showSideChannel: !['guest', 'customer'].includes(identity),
      showAI: !['guest', 'customer', "assistant"].includes(identity),
    };
  }, [platUser, space]);

  /**
   * 自动进入某个房间的逻辑
   * - 当platUser中有room字段时，说明需要进入指定房间
   *   - room = '$empty': 进入任意一个空闲房间
   *   - room = '$space': 无需处理，不进入子房间
   *   - room = 'roomName': 进入指定名称的房间，无论是不是私人房间
   * - 当auth字段为c_s时，说明进入了customer - service模式，用户需要进入某个空闲房间
   * - 这里的空闲房间指的是某个私人房间，且这个私人房间只有房间拥有者(客服)一个人，顾客需要进入这个房间
   * - 这个函数只会调用api让后端进行处理，不会在前端进行任何房间选择的逻辑处理，防止数据不同步的问题
   */
  const roomEnter = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!platUser) return;
    if (!space) return;
    try {
      const response = await api.enterRoom(
        space.name,
        platUser.auth,
        platUser.id,
        space.localParticipant.name || platUser.username,
        platUser.room,
        platUser.identity,
      );
      if (!response.ok) {
        throw new Error(`Failed to enter room: ${response.status}`);
      }
      onEnterRoom?.();
    } catch (error) {
      console.error('Failed to enter room:', error);
    }
  }, [platUser, onEnterRoom, space]);

  return {
    platUser,
    roomEnter,
    fromVocespace,
    auth,
    showSideChannel,
    showAI,
  };
};

/**
 * 判断当前是否应该创建房间, 由于localStorage只能在客户端使用, 因此该函数只能在客户端调用
 * 为什么需要这个函数？
 * 因为在useState时可能需要根据是否是vocespace/space平台用户来决定初始值
 * @returns
 */
export const isCreateRoom = (): boolean => {
  if (typeof window === 'undefined') return true;
  const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER);
  if (storedUserInfo) {
    const parsedInfo = JSON.parse(storedUserInfo) as PlatformUser;
    return parsedInfo.auth !== 'c_s';
  }
  return true;
};

/**
 * 一种简单快捷的方式处理用户数据，直接返回需要的信息，不使用任何react hook
 * 适合需要简单处理的场景
 */
export const getParticipantPlatformInfo = ({ user }: { user: ParticipantSettings | undefined }) => {
  const auth = user?.auth;

  const isAuth = auth ? auth.platform === 'vocespace' || auth.platform === 'space' : false;
  const createRoom = auth ? !(auth.platform === 'c_s') : true;

  return {
    isAuth,
    createRoom,
  };
};

/** @deprecated Use the pure getParticipantPlatformInfo helper. */
export const usePlatformUserInfoCheap = getParticipantPlatformInfo;
