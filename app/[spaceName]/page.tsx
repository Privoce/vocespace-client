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

  const [userInfo, setUserInfo] = React.useState<LoginStateBtnProps | null>(null);
  // 不携带任何参数时需要从localStorage中尝试获取，来确定之前的登陆状态
  React.useEffect(() => {
    const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER_ID);
    if (storedUserInfo) {
      setUserInfo(JSON.parse(storedUserInfo));
    }
  }, []);
  // 当url携带参数时，优先使用url中的参数并存储到localStorage
  React.useEffect(() => {
    if (searchParams.username && searchParams.userId && searchParams.auth) {
      const newUserInfo = {
        username: searchParams.username,
        userId: searchParams.userId,
        auth: searchParams.auth,
      };
      setUserInfo(newUserInfo);
      localStorage.setItem(VOCESPACE_PLATFORM_USER_ID, JSON.stringify(newUserInfo));
    }
  }, [searchParams]);

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
