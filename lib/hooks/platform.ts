/**
 * 获取从home.vocespace.com提供的平台信息到localStorage的hook
 * 该hook只允许使用者获取数据，不允许修改数据
 */

'use client';

import { useMemo, useState } from 'react';
import { VOCESPACE_PLATFORM_USER } from '../std/space';
import {
  AuthType,
  TokenResult,
  IdentityType,
  RoomType,
  SearchParams,
  PlatformUser,
  verifyPlatformUser,
} from '../std';
import equal from 'fast-deep-equal';
import { ConnectionDetails } from '../types';
import { MessageInstance } from 'antd/es/message/interface';
import { useI18n } from '../i18n/i18n';

// export interface UsePlatformUserInfoProps {
//   /**
//    * 本地用户的id，用于判断是否平台登陆和判断信息是否为当前用户所有
//    */
//   uid: string;
// }

// /**
//  * PUserInfo 平台用户信息类型
//  */
// export interface PUserInfo {
//   userId?: string;
//   username?: string;
//   auth?: AuthType;
//   avatar?: string;
// }

// export interface PUserMeta {
//   username: string;
//   avatar: string;
// }

// export interface UsePlatformUserInfoExports {
//   platUser: PUserInfo | null;
// }

// export const usePlatformUserInfo = ({
//   uid,
// }: UsePlatformUserInfoProps): UsePlatformUserInfoExports => {
//   const platUser: PUserInfo | null = useMemo(() => {
//     const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER);
//     if (storedUserInfo) {
//       const parsedInfo = JSON.parse(storedUserInfo) as PUserInfo;
//       return parsedInfo.userId === uid ? parsedInfo : null;
//     } else {
//       return null;
//     }
//   }, [uid]);

//   return { platUser };
// };

export interface UsePlatformUserProps {
  searchParams: SearchParams;
  messageApi: MessageInstance
}

/**
 * 解析来自某个平台的Token得到需要的信息，返回TokenResult
 * @param token
 */
export { parseToken, generateToken } from './platformToken';

export function usePlatformUser({ searchParams,messageApi }: UsePlatformUserProps) {
  const {t} = useI18n();
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
        messageApi.warning(t('api.token.url'));
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
        messageApi.warning(t('api.token.url'));
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
export const usePlatformUserInfo = ({ uid }: { uid: string }) => {
  const platUser: PlatformUser | null = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER);
    if (storedUserInfo) {
      const parsedInfo = JSON.parse(storedUserInfo) as PlatformUser;
      return parsedInfo.id === uid ? parsedInfo : null;
    } else {
      return null;
    }
  }, [uid]);

  return { platUser };
};
