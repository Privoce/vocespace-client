// 获取动态配置
import { ApiRequest, ApiResponse } from '../http';
import {
  getConfig,
  isConfigInitialized,
  setStoredConf,
  setConfigEnv,
  setConfigLicense,
  setConfigRoomLicense,
  setConfigSMTP,
  setConfigHyperbeam,
  setFullConfig,
  writeBackConfig,
} from '@/lib/server/config';
import { AIConf, clearReadableConf, HyperbeamConf, RTCConf, SMTPConf, VocespaceConfig } from '@/lib/std/conf';
import { UpdateCreateSpaceConfBody } from '@/lib/api/conf';
import { authorizeConfigMutation, verifyHostToken } from '@/lib/server/host-authorization';
import { HostAuthorizationError } from '@vocespace/server-core';

export async function GET(request: ApiRequest) {
  const hostToken = request.headers.get('x-vocespace-host-token') ?? request.nextUrl.searchParams.get('hostToken');
  let config = getConfig();
  setStoredConf(config);
  const readableConfig = {
    ...clearReadableConf(config, hostToken),
    initialized: isConfigInitialized(),
  };
  return ApiResponse.json(readableConfig, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

export async function POST(request: ApiRequest) {
  const isUpdateLicense = request.nextUrl.searchParams.get('license');
  const isUpdateAI = request.nextUrl.searchParams.get('ai');
  const isUpdateSMTP = request.nextUrl.searchParams.get('smtp') === 'true';
  const isUpdateHyperbeam = request.nextUrl.searchParams.get('hyperbeam') === 'true';
  const isSetup = request.nextUrl.searchParams.get('setup') === 'true';
  const isCheckHostToken = request.nextUrl.searchParams.get('check') === 'true';
  const isCreateSpace = request.nextUrl.searchParams.get('create_space') === 'true';
  // These operations already have host verification UI; enforce it at the write boundary too.
  // Room quality/license commands retain their legacy policy until room sessions are migrated.
  if (isSetup || isUpdateAI || isUpdateSMTP || isUpdateHyperbeam || isCreateSpace) {
    let body: unknown;
    try {
      body = await request.clone().json();
    } catch {
      return ApiResponse.json({ success: false, error: 'invalid JSON body' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return ApiResponse.json({ success: false, error: 'invalid request body' }, { status: 400 });
    }
    const token = request.headers.get('x-vocespace-host-token') ??
      ('hostToken' in body ? body.hostToken : undefined);
    try {
      authorizeConfigMutation(token, isSetup);
    } catch (error) {
      if (error instanceof HostAuthorizationError) {
        return ApiResponse.json({ success: false, error: error.message }, { status: 403 });
      }
      throw error;
    }
  }
  if (isSetup) {
    const conf = (await request.json()) as VocespaceConfig;
    try {
      const { success, error } = setFullConfig(conf);
      if (!success) {
        throw error;
      }
    } catch (e) {
      return ApiResponse.json(
        {
          success: false,
          error: 'can not initialize config',
        },
        { status: 500 },
      );
    }
    return ApiResponse.json({ success: true }, { status: 200 });
  }
  // 更新创建空间配置 ---------------------------------------------------------------------------
  if (isCreateSpace) {
    const { createStrategy, whiteList }: UpdateCreateSpaceConfBody = await request.json();

    const conf = getConfig();
    conf.create_space = createStrategy;
    conf.whiteList = whiteList;
    try {
      const { success, error } = writeBackConfig(conf);
      if (!success) {
        throw error;
      }
    } catch (e) {
      return ApiResponse.json(
        {
          success: false,
          error: 'can not update create space config',
        },
        { status: 500 },
      );
    }
    return ApiResponse.json({ success: true }, { status: 200 });
  }

  // 验证host token --------------------------------------------------------------------------------
  if (isCheckHostToken) {
    const { hostToken }: { hostToken: string } = await request.json();
    return ApiResponse.json({ success: verifyHostToken(hostToken) }, { status: 200 });
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
      return ApiResponse.json(
        {
          success: false,
          error: 'can not update ai config',
        },
        { status: 500 },
      );
    }
    return ApiResponse.json({ success: true }, { status: 200 });
  }

  if (isUpdateSMTP) {
    const { smtpConf }: { smtpConf: SMTPConf } = await request.json();
    try {
      const { success, error } = setConfigSMTP(smtpConf);
      if (!success) {
        throw error;
      }
    } catch (_e) {
      return ApiResponse.json(
        {
          success: false,
          error: 'can not update smtp config',
        },
        { status: 500 },
      );
    }
    return ApiResponse.json({ success: true }, { status: 200 });
  }

  if (isUpdateHyperbeam) {
    const { hyperbeamConf }: { hyperbeamConf: HyperbeamConf } = await request.json();
    try {
      const { success, error } = setConfigHyperbeam(hyperbeamConf);
      if (!success) {
        throw error;
      }
    } catch (_e) {
      return ApiResponse.json(
        {
          success: false,
          error: 'can not update hyperbeam config',
        },
        { status: 500 },
      );
    }
    return ApiResponse.json({ success: true }, { status: 200 });
  }

  if (isUpdateLicense) {
    const { license } = await request.json();
    if (!license || license.trim() === '') {
      return ApiResponse.json(
        {
          success: false,
          error: 'license is empty',
        },
        { status: 200 },
      );
    } else {
      const { success, error } = setConfigLicense(license);
      if (success) {
        return ApiResponse.json({ success: true }, { status: 200 });
      } else {
        return ApiResponse.json(
          {
            success,
            error,
          },
          { status: 500 },
        );
      }
    }
  }

  const isRoomLicense = request.nextUrl.searchParams.get('room_license') === 'true';
  if (isRoomLicense) {
    const { license, roomName } = await request.json();
    if (!license || license.trim() === '' || !roomName) {
      return ApiResponse.json(
        {
          success: false,
          error: 'license or roomName is empty',
        },
        { status: 200 },
      );
    } else {
      const { success, error } = setConfigRoomLicense(license, roomName);
      if (success) {
        return ApiResponse.json({ success: true }, { status: 200 });
      } else {
        return ApiResponse.json(
          {
            success,
            error,
          },
          { status: 500 },
        );
      }
    }
  }

  const env: RTCConf = await request.json();

  const { success, error } = setConfigEnv(env);
  if (success) {
    return ApiResponse.json({ success }, { status: 200 });
  } else {
    return ApiResponse.json(
      {
        success,
        error,
      },
      { status: 500 },
    );
  }
}
