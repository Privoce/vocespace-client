'use client';

import * as React from 'react';
import { PageClientImpl } from './PageClientImpl';
import { isVideoCodec } from '@/lib/types';
import { RecoilRoot } from 'recoil';
import { VOCESPACE_PLATFORM_USER_ID } from '@/lib/std/space';
import { PUserInfo, PUserMeta } from '@/lib/hooks/platform';
import { api } from '@/lib/api';
import { LoginStateBtnProps } from '@/app/pages/pre_join/login';

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
    // 这里目的是为了标识返回的url，不是为了区分登录方式，从vocespace.com就是vocespace，从space.voce.chat就是space，暂时没有特殊意义
    // 即使没有这个参数也不会影响功能
    auth?: 'vocespace' | 'space';
  };
}) {
  const [loading, setLoading] = React.useState(true);
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
      return urlUserInfo;
    }
    return {};
  });

  const checkAndFetchByStored = async () => {
    setLoading(true);
    // 检查是否在客户端环境中
    const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER_ID);
    // console.warn('Checking localStorage for user info', storedUserInfo);
    if (storedUserInfo) {
      try {
        const parsedInfo = JSON.parse(storedUserInfo) as LoginStateBtnProps;
        // 登陆后向平台服务器请求完整信息
        const response = await api.getUserMeta(parsedInfo.userId);

        if (response.ok) {
          const { data, online }: { data: PUserMeta; online: boolean } = await response.json();
          if (online) {
            const updatedInfo = {
              ...parsedInfo,
              username: data.username,
              avatar: data.avatar,
            };
            setUserInfo(updatedInfo);
            // 更新本地存储
            localStorage.setItem(VOCESPACE_PLATFORM_USER_ID, JSON.stringify(updatedInfo));
            return;
          }
        }
        // 用户不在线，清除本地存储
        localStorage.removeItem(VOCESPACE_PLATFORM_USER_ID);
        setUserInfo({} as LoginStateBtnProps);
      } catch (error) {
        console.error('Failed to parse stored user info:', error);
        setUserInfo({} as LoginStateBtnProps);
      } finally {
        setTimeout(() => {
          setLoading(false);
        }, 500);
      }
    } else {
      setUserInfo({} as LoginStateBtnProps);
      setTimeout(() => {
        setLoading(false);
      }, 500);
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
      // console.log('Saving URL params to localStorage:', newUserInfo);
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
        loading={loading}
        setLoading={setLoading}
      />
    </RecoilRoot>
  );
}
