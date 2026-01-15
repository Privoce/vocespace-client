// 获取动态配置
import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setStoredConf, setConfigEnv, setConfigLicense, writeBackConfig } from './conf';
import { AIConf, clearReadableConf, RTCConf } from '@/lib/std/conf';

export async function GET(request: NextRequest) {
  const hostToken = request.nextUrl.searchParams.get('hostToken');
  let config = getConfig();
  setStoredConf(config);
  const readableConfig = clearReadableConf(config, hostToken);
  return NextResponse.json(readableConfig, { status: 200 });
}

export async function POST(request: NextRequest) {
  const isUpdateLicense = request.nextUrl.searchParams.get('license');
  const isUpdateAI = request.nextUrl.searchParams.get('ai');
  const isCheckHostToken = request.nextUrl.searchParams.get('check') === 'true';
  // 验证host token --------------------------------------------------------------------------------
  if (isCheckHostToken) {
    const { hostToken }: { hostToken: string } = await request.json();
    const config = getConfig();
    return NextResponse.json({ success: hostToken === config.hostToken }, { status: 200 });
  }
  // 更新AI配置 -------------------------------------------------------------------------------------
  if (isUpdateAI) {
    const { aiConf }: { aiConf: AIConf } = await request.json();
    const conf = getConfig();
    conf.ai = aiConf;
    try {
      const { success, error } = writeBackConfig(conf);
      if (!success) {
        throw error;
      }
    } catch (e) {
      return NextResponse.json(
        {
          success: false,
          error: 'can not update ai config',
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true }, { status: 200 });
  }

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
