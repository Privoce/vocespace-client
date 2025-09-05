'use client';

import * as React from 'react';
import { PageClientImpl } from './PageClientImpl';
import { isVideoCodec } from '@/lib/types';
import { RecoilRoot } from 'recoil';

export interface SearchParams {
  region?: string;
  hq?: string;
  codec?: string;
  userId: string;
  username: string;
  roomId?: string;
  roomName?: string;
}

export default function Page({
  params,
  searchParams,
}: {
  params: { spaceName: string };
  searchParams: SearchParams;
}) {
  const codec =
    typeof searchParams.codec === 'string' && isVideoCodec(searchParams.codec)
      ? searchParams.codec
      : 'vp9';
  const hq = searchParams.hq === 'true' ? true : false;
  return (
    <RecoilRoot>
      <PageClientImpl
        spaceName={params.spaceName}
        region={searchParams.region}
        hq={hq}
        codec={codec}
        userId={searchParams.userId}
        username={searchParams.username}
        roomId={searchParams.roomId}
        roomName={searchParams.roomName}
      />
    </RecoilRoot>
  );
}
