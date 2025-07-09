// 获取环境变量中设置的env参数
//   NEXT_PUBLIC_RESOLUTION: RESOLUTION = '1080p',
//   NEXT_PUBLIC_MAXBITRATE = '12000', // 12Mbps
//   NEXT_PUBLIC_MAXFRAMERATE = '30', // 30fps
//   NEXT_PUBLIC_PRIORITY = 'medium',

import { EnvConf } from '@/lib/std/env';
import { NextRequest, NextResponse } from 'next/server';

const {
  NEXT_PUBLIC_RESOLUTION = '1080p',
  NEXT_PUBLIC_MAXBITRATE = '12000', // 12Mbps
  NEXT_PUBLIC_MAXFRAMERATE = '30', // 30fps
  NEXT_PUBLIC_PRIORITY = 'medium',
} = process.env;

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      resolution: NEXT_PUBLIC_RESOLUTION,
      maxBitrate: parseInt(NEXT_PUBLIC_MAXBITRATE, 10),
      maxFramerate: parseInt(NEXT_PUBLIC_MAXFRAMERATE, 10),
      priority: NEXT_PUBLIC_PRIORITY as RTCPriorityType,
    } as EnvConf,
    { status: 200 },
  );
}
