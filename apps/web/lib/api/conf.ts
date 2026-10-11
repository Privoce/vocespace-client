import { UpdateCreateSpaceConfBody } from '@vocespace/domain/requests/conf';
export * from '@vocespace/domain/requests/conf';
import { apiFetch } from '@/lib/api/client';
import { connect_endpoint } from '@/lib/std/index';
import {
  AIConf,
  CreateSpaceStrategy,
  HyperbeamConf,
  RTCConf,
  SMTPConf,
  VocespaceConfig,
} from '@/lib/std/conf';

const CONF_API_URL = connect_endpoint('/api/conf');
export const getConf = async (hostToken?: string) => {
  const url = new URL(CONF_API_URL, window.location.origin);
  return await apiFetch(url.toString(), {
    headers: hostToken ? { 'x-vocespace-host-token': hostToken } : undefined,
  });
};

export const checkHostToken = async (hostToken: string) => {
  const url = new URL(CONF_API_URL, window.location.origin);
  url.searchParams.append('check', 'true');
  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hostToken }),
  });
};

export const reloadConf = async (env: RTCConf): Promise<Response> => {
  const url = new URL(CONF_API_URL, window.location.origin);
  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(env),
  });
};

export const reloadLicense = async (license: string): Promise<Response> => {
  const url = new URL(CONF_API_URL, window.location.origin);
  url.searchParams.append('license', 'true');
  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ license }),
  });
};

/**
 * 更新房间证书（写入配置文件）
 * @param license 房间证书JWT值
 * @param roomName 房间名称
 */
export const reloadRoomLicense = async (license: string, roomName: string): Promise<Response> => {
  const url = new URL(CONF_API_URL, window.location.origin);
  url.searchParams.append('room_license', 'true');
  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ license, roomName }),
  });
};

export const updateAIConf = async (aiConf: AIConf, hostToken?: string): Promise<Response> => {
  const url = new URL(CONF_API_URL, window.location.origin);
  url.searchParams.append('ai', 'true');
  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ aiConf, hostToken }),
  });
};

export const updateSMTPConf = async (
  smtpConf: SMTPConf,
  hostToken: string,
): Promise<Response> => {
  const url = new URL(CONF_API_URL, window.location.origin);
  url.searchParams.append('smtp', 'true');
  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ smtpConf, hostToken }),
  });
};

export const updateHyperbeamConf = async (
  hyperbeamConf: HyperbeamConf,
  hostToken: string,
): Promise<Response> => {
  const url = new URL(CONF_API_URL, window.location.origin);
  url.searchParams.append('hyperbeam', 'true');
  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hyperbeamConf, hostToken }),
  });
};

export const setupConf = async (conf: VocespaceConfig, currentHostToken?: string): Promise<Response> => {
  const url = new URL(CONF_API_URL, window.location.origin);
  url.searchParams.append('setup', 'true');
  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(currentHostToken ? { 'x-vocespace-host-token': currentHostToken } : {}),
    },
    body: JSON.stringify(conf),
  });
};

export const updateCreateSpaceConf = async (
  createStrategy: CreateSpaceStrategy,
  whiteList: string[] | undefined | Set<string>,
  hostToken?: string,
): Promise<Response> => {
  const url = new URL(CONF_API_URL, window.location.origin);
  url.searchParams.append('create_space', 'true');
  const whiteListArray = whiteList
    ? Array.isArray(whiteList)
      ? whiteList
      : Array.from(whiteList)
    : [];
  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ createStrategy, whiteList: whiteListArray, hostToken }),
  });
};
