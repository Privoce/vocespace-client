// 获取动态配置
import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setStoredConf, setConfigEnv, setConfigLicense } from './conf';
import { RTCConf } from '@/lib/std/conf';

export async function GET(_request: NextRequest) {
  let config = getConfig();
  setStoredConf(config);
  return NextResponse.json(config, { status: 200 });
}

export async function POST(request: NextRequest) {
  const isUpdateLicense = request.nextUrl.searchParams.get('license');
  if (isUpdateLicense) {
    const { license } = await request.json();
    if (!license || license.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'license is empty',
        },
        { status: 200 },
      );
    } else {
      const { success, error } = setConfigLicense(license);
      if (success) {
        return NextResponse.json({ success: true }, { status: 200 });
      } else {
        return NextResponse.json(
          {
            success,
            error,
          },
          { status: 500 },
        );
      }
    }
  } else {
    const env: RTCConf = await request.json();

    const { success, error } = setConfigEnv(env);
    if (success) {
      return NextResponse.json({ success }, { status: 200 });
    } else {
      return NextResponse.json(
        {
          success,
          error,
        },
        { status: 500 },
      );
    }
  }
}
