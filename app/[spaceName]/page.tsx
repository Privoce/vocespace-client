'use client';

import * as React from 'react';
import { PageClientImpl } from './PageClientImpl';
import { isVideoCodec } from '@/lib/types';
import { RecoilRoot } from 'recoil';
import { VOCESPACE_PLATFORM_USER_ID } from '@/lib/std/space';
import { LoginStateBtnProps } from '../pages/pre_join/login';
import { PUserInfo, PUserMeta } from '@/lib/hooks/platform';
import { api } from '@/lib/api';

export default function Page({
  params,
  searchParams,
}: {
  params: { spaceName: string };
  searchParams: {
    region?: string;
    hq?: string;
    codec?: string;
    username?: string;
    userId?: string;
    auth?: 'vocespace' | 'google';
  };
}) {
  const codec =
    typeof searchParams.codec === 'string' && isVideoCodec(searchParams.codec)
      ? searchParams.codec
      : 'vp9';
  const hq = searchParams.hq === 'true' ? true : false;

  const [userInfo, setUserInfo] = React.useState<PUserInfo>(() => {
    // 在服务器端，优先使用 URL 参数
    if (searchParams.username && searchParams.userId && searchParams.auth) {
      const urlUserInfo: PUserInfo = {
        username: searchParams.username,
        userId: searchParams.userId,
        auth: searchParams.auth,
      };
      console.log('Using URL params for userInfo:', urlUserInfo);
      return urlUserInfo;
    }
    return {};
  });

  const checkAndFetchByStored = async () => {
    // 检查是否在客户端环境中
    const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER_ID);
    console.warn('Checking localStorage for user info', storedUserInfo);
    if (storedUserInfo) {
      try {
        const parsedInfo = JSON.parse(storedUserInfo) as LoginStateBtnProps;
        // 登陆后向平台服务器请求完整信息
        const response = await api.getUserMeta(parsedInfo.userId);

        if (response.ok) {
          const data: PUserMeta = await response.json();
          const updatedInfo = {
            ...parsedInfo,
            username: data.username,
            avatar: data.avatar,
          };
          setUserInfo(updatedInfo);
          // 更新本地存储
          localStorage.setItem(VOCESPACE_PLATFORM_USER_ID, JSON.stringify(updatedInfo));
        } else {
          setUserInfo(parsedInfo);
        }
      } catch (error) {
        console.error('Failed to parse stored user info:', error);
        setUserInfo({} as LoginStateBtnProps);
      }
    } else {
      setUserInfo({} as LoginStateBtnProps);
    }
  };

  // 在客户端检查 localStorage
  React.useEffect(() => {
    checkAndFetchByStored();
  }, []); // 只在组件挂载时运行一次

  // 当有 URL 参数时，保存到 localStorage
  React.useEffect(() => {
    if (searchParams.username && searchParams.userId && searchParams.auth) {
      const newUserInfo = {
        username: searchParams.username,
        userId: searchParams.userId,
        auth: searchParams.auth,
      };
      console.log('Saving URL params to localStorage:', newUserInfo);
      setUserInfo(newUserInfo);
      if (typeof window !== 'undefined') {
        localStorage.setItem(VOCESPACE_PLATFORM_USER_ID, JSON.stringify(newUserInfo));
      }
    }
  }, [searchParams.username, searchParams.userId, searchParams.auth]);

  return (
    <RecoilRoot>
      <PageClientImpl
        spaceName={params.spaceName}
        region={searchParams.region}
        hq={hq}
        codec={codec}
        username={userInfo?.username}
        userId={userInfo?.userId}
        auth={userInfo?.auth}
        avatar={userInfo?.avatar}
      />
    </RecoilRoot>
  );
}
