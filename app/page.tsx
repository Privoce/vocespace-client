"use client";

import * as React from 'react';
import { isVideoCodec } from '@/lib/types';
import { RecoilRoot } from 'recoil';
import { PageClientImpl } from './[roomName]/PageClientImpl';

export default function Page({
  params,
  searchParams,
}: {
  params: { roomName: string };
  searchParams: {
    // FIXME: We should not allow values for regions if in playground mode.
    region?: string;
    hq?: string;
    codec?: string;
  };
}) {
  const codec =
    typeof searchParams.codec === 'string' && isVideoCodec(searchParams.codec)
      ? searchParams.codec
      : 'vp9';
  const hq = searchParams.hq === 'true' ? true : false;
  return (
    <RecoilRoot>
      <PageClientImpl
        roomName={params.roomName}
        region={searchParams.region}
        hq={hq}
        codec={codec}
      />
    </RecoilRoot>
  );
}
