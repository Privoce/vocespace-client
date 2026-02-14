'use client';

import * as React from 'react';
import { PageClientImpl } from './PageClientImpl';
import { isVideoCodec } from '@/lib/types';
import { RecoilRoot } from 'recoil';
import { SearchParams } from '@/lib/std';
import { usePlatformUser } from '@/lib/hooks/platform';
import useMessage from 'antd/es/message/useMessage';
import { message } from 'antd';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function Page({
  params,
  searchParams,
}: {
  params: { spaceName: string };
  searchParams: SearchParams;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const codec =
    typeof searchParams.codec === 'string' && isVideoCodec(searchParams.codec)
      ? searchParams.codec
      : 'vp9';
  const hq = searchParams.hq === 'true' ? true : false;
  const { checkOrUpdateStore, platformUser, details, isValid } = usePlatformUser({
    searchParams,
    messageApi,
  });

  const checkAndFetchByStored = async () => {
    setLoading(true);

    try {
      if (searchParams.childRoomEnter) {
        const response = await api.enterSpaceRoomFromLink({
          ...JSON.parse(decodeURIComponent(searchParams.childRoomEnter as string)),
          platUser: platformUser,
        });
        if (response.ok) {
          const { redirectUrl, cookie }: { redirectUrl: string; cookie: string } =
            await response.json();
          router.replace(redirectUrl);
        }
      } else {
        await checkOrUpdateStore();
      }
    } catch (error) {
      console.error('enterRoom error:', error);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  };

  /**
   * 后端虽然做了一层验证，但为了更好的用户体验，还是在客户端多做一层验证
   * 如果数据无效，则跳回空间主页重新进入
   */
  React.useEffect(() => {
    if (!isValid) {
      setTimeout(() => {
        router.replace(`/${params.spaceName}`);
      }, 1000);
    }
  }, [isValid]);

  // 在客户端检查 localStorage
  React.useEffect(() => {
    checkAndFetchByStored();
  }, []); // 只在组件挂载时运行一次

  return (
    <RecoilRoot>
      {contextHolder}
      <PageClientImpl
        spaceName={params.spaceName}
        region={searchParams.region}
        hq={hq}
        codec={codec}
        auth={searchParams.auth}
        loading={loading}
        setLoading={setLoading}
        room={searchParams.room}
        data={platformUser}
        details={details}
        messageApi={messageApi}
      />
    </RecoilRoot>
  );
}
