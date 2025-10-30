/**
 * 获取从home.vocespace.com提供的平台信息到localStorage的hook
 * 该hook只允许使用者获取数据，不允许修改数据
 */

import { useMemo } from 'react';
import { VOCESPACE_PLATFORM_USER_ID } from '../std/space';

export interface UsePlatformUserInfoProps {
  /**
   * 本地用户的id，用于判断是否平台登陆和判断信息是否为当前用户所有
   */
  uid: string;
}

export interface PUserInfo {
  userId?: string;
  username?: string;
  auth?: 'google' | 'vocespace';
  avatar?: string;
}

export interface PUserMeta {
  username: string;
  avatar: string;
}

export interface UsePlatformUserInfoExports {
  platUser: PUserInfo | null;
}

export const usePlatformUserInfo = ({
  uid,
}: UsePlatformUserInfoProps): UsePlatformUserInfoExports => {
  const platUser: PUserInfo | null = useMemo(() => {
    const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER_ID);
    if (storedUserInfo) {
      const parsedInfo = JSON.parse(storedUserInfo) as PUserInfo;
      return parsedInfo.userId === uid ? parsedInfo : null;
    } else {
      return null;
    }
  }, [uid]);

  return { platUser };
};
