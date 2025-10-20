'use client';

import * as React from 'react';
import { PageClientImpl } from './PageClientImpl';
import { isVideoCodec } from '@/lib/types';
import { RecoilRoot } from 'recoil';
import { VOCESPACE_PLATFORM_USER_ID } from '@/lib/std/space';
import { LoginStateBtnProps } from '../pages/pre_join/login';

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

  const [userInfo, setUserInfo] = React.useState<LoginStateBtnProps>(() => {
    // 在服务器端，优先使用 URL 参数
    if (searchParams.username && searchParams.userId && searchParams.auth) {
      const urlUserInfo = {
        username: searchParams.username,
        userId: searchParams.userId,
        auth: searchParams.auth,
      };
      console.log('Using URL params for userInfo:', urlUserInfo);
      return urlUserInfo;
    }
    
    console.log('No URL params found, will check localStorage in useEffect');
    return {};
  });

  // 在客户端检查 localStorage
  React.useEffect(() => {
    // 如果已经有用户信息（从 URL 参数），不需要检查 localStorage
    if (userInfo.username && userInfo.userId) {
      return;
    }

    // 尝试从 localStorage 获取用户信息
    const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER_ID);
    if (storedUserInfo) {
      try {
        const parsed = JSON.parse(storedUserInfo);
        console.log('Loading userInfo from localStorage:', parsed);
        setUserInfo(parsed);
      } catch (e) {
        console.error('Failed to parse localStorage userInfo:', e);
      }
    }
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
      />
    </RecoilRoot>
  );
}
