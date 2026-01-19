/**
 * 获取从home.vocespace.com提供的平台信息到localStorage的hook
 * 该hook只允许使用者获取数据，不允许修改数据
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import { VOCESPACE_PLATFORM_USER } from '../std/space';
import { AuthType, TokenResult, SearchParams, PlatformUser, verifyPlatformUser } from '../std';
import equal from 'fast-deep-equal';
import { ConnectionDetails } from '../types';
import { MessageInstance } from 'antd/es/message/interface';
import { useI18n } from '../i18n/i18n';
import { api } from '../api';
import { Room } from 'livekit-client';

export interface UsePlatformUserProps {
  searchParams: SearchParams;
  messageApi: MessageInstance;
}

/**
 * 解析来自某个平台的Token得到需要的信息，返回TokenResult
 * @param token
 */
export { parseToken, generateToken } from './platformToken';

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
    // 检查是否在客户端环境中
    const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER);
    if (storedUserInfo) {
      // 本地已有用户信息，检查是否需要更新
      const parsedInfo = JSON.parse(storedUserInfo) as PlatformUser;
      // 在此之前先确定数据实效性
      if (!verifyPlatformUser(parsedInfo)) {
        messageApi.warning(t('api.token.out_of_date'));
        // 数据无效，清除
        localStorage.removeItem(VOCESPACE_PLATFORM_USER);
      }
      // 没有auth,data,details参数则直接返回，三个参数必须同时存在
      if (!searchParams.auth || !searchParams.data || !searchParams.details) {
        setPlatformUser(parsedInfo);
        return;
      }
      const platformNewInfo: PlatformUser = castToPlatformUser(
        searchParams.data,
        searchParams.auth,
      );
      const connectionDetails: ConnectionDetails = castToConnectionDetails(searchParams.details);
      if (!verifyPlatformUser(platformNewInfo)) {
        messageApi.warning(t('api.token.out_of_date'));
        // 数据无效，直接返回
        setPlatformUser(parsedInfo);
        return;
      }
      setDetails(connectionDetails);
      setIsValid(true);
      // 使用isEqual进行深度比较
      if (!equal(parsedInfo, platformNewInfo)) {
        // 不相等则更新
        localStorage.setItem(VOCESPACE_PLATFORM_USER, JSON.stringify(platformNewInfo));
      }
      // 相等则直接使用已有数据
      setPlatformUser(platformNewInfo);
    } else {
      // 本地没有用户信息，检查searchParams中是否有auth和data参数
      if (!searchParams.auth || !searchParams.data || !searchParams.details) {
        return;
      }
      const platformNewInfo: PlatformUser = castToPlatformUser(
        searchParams.data,
        searchParams.auth,
      );
      const connectionDetails: ConnectionDetails = castToConnectionDetails(searchParams.details);
      if (!verifyPlatformUser(platformNewInfo)) {
        // 数据无效，直接返回
        messageApi.warning(t('api.token.out_of_date'));
        return;
      }
      // 数据有效，存储并使用
      localStorage.setItem(VOCESPACE_PLATFORM_USER, JSON.stringify(platformNewInfo));
      setDetails(connectionDetails);
      setPlatformUser(platformNewInfo);
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

/**
 * 这个hook只需要从localStorage中获取平台用户信息
 * @param param0
 */
export const usePlatformUserInfo = ({
  uid,
  space,
  onEnterRoom,
}: {
  space?: Room;
  uid: string;
  onEnterRoom?: () => void;
}) => {
  const platUser: PlatformUser | null = useMemo(() => {
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

  const { isAuth, createRoom } = useMemo(() => {
    // 只有platUser是null时或者auth类型不是c_s才会创建房间
    return {
      isAuth: platUser !== null && (platUser.auth === 'vocespace' || platUser.auth === 'space'),
      createRoom: !platUser || platUser.auth !== 'c_s',
    };
  }, [platUser]);

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
  return { platUser, isAuth, createRoom, roomEnter };
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
