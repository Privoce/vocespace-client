import { Socket } from 'socket.io-client';
import { connect_endpoint, UserDefineStatus } from '../std';
import {
  AppAuth,
  AppKey,
  ParticipantSettings,
  RecordSettings,
  SpaceCountdown,
  SpaceTimer,
  SpaceTodo,
} from '../std/space';

const SPACE_API = connect_endpoint('/api/space');

/**
 * 加入空间
 * @param spaceName 空间名称
 * @param username 用户名
 * @param region 可选的区域
 */
export const joinSpace = async (spaceName: string, username: string, region?: string) => {
  const url = new URL(connect_endpoint('/api/connection-details'), window.location.origin);
  url.searchParams.append('spaceName', spaceName);
  url.searchParams.append('participantName', username);
  if (region) {
    url.searchParams.append('region', region);
  }
  return await fetch(url.toString());
};

/**
 * 获取所有空间的信息
 */
export const allSpaceInfos = async () => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('all', 'true');
  url.searchParams.append('detail', 'true');
  return await fetch(url.toString());
};

/**
 * 获取历史空间信息
 */
export const historySpaceInfos = async () => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('timeRecord', 'true');
  return await fetch(url.toString());
};
/**
 *  向服务器请求一个唯一的用户名
 */
export const getUniqueUsername = async (spaceName: string) => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('spaceName', spaceName);
  url.searchParams.append('pre', 'true');
  return await fetch(url.toString());
};

export interface CheckNameBody {
  spaceName: string;
  participantName: string;
}

/**
 * 检查用户名是否可用
 * @param spaceName 空间名称
 * @param participantName 用户名称
 */
export const checkUsername = async (spaceName: string, participantName: string) => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('nameCheck', 'true');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      participantName,
    } as CheckNameBody),
  });
};

export interface DefineUserStatusBody {
  spaceName: string;
  status: UserDefineStatus;
}

export interface DefineUserStatusResponse {
  success: boolean;
  status?: UserDefineStatus[];
  spaceName?: string;
  error?: any;
}

export const defineUserStatus = async (spaceName: string, status: UserDefineStatus) => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('status', 'true');
  return await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      spaceName,
      status,
    } as DefineUserStatusBody),
  });
};

/**
 * ## 获取某个空间的数据
 * @param spaceName
 * @returns
 */
export const getSpaceInfo = async (spaceName: string) => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('spaceName', spaceName);
  return await fetch(url.toString());
};

export interface UpdateOwnerIdBody {
  spaceName: string;
  participantId: string;
}

export const updateOwnerId = async (spaceName: string, replacedId: string) => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('ownerId', 'update');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      participantId: replacedId,
    } as UpdateOwnerIdBody),
  });
};

export interface DeleteSpaceParticipantBody {
  spaceName: string;
  participantId: string;
}

/**
 * ## 从空间中删除参与者
 * @param spaceName
 * @param participantId
 * @returns
 */
export const deleteSpaceParticipant = async (spaceName: string, participantId: string) => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('participant', 'delete');
  url.searchParams.append('space', 'true');
  return await fetch(url.toString(), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      participantId,
    } as DeleteSpaceParticipantBody),
  });
};

export interface UpdateSpaceParticipantBody {
  spaceName: string;
  participantId: string;
  settings: ParticipantSettings;
  record?: RecordSettings;
}

/**
 * 更新空间参与者的设置
 */
export const updateSpaceParticipant = async (
  spaceName: string,
  participantId: string,
  settings: Partial<ParticipantSettings>,
  record?: RecordSettings,
) => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('participant', 'update');
  url.searchParams.append('space', 'true');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      participantId,
      settings,
      record,
    } as UpdateSpaceParticipantBody),
  });
};

export interface UpdateSpaceAppsBody {
  spaceName: string;
  appKey: AppKey;
  enabled: boolean;
}

export const updateSpaceApps = async (spaceName: string, appKey: AppKey, enabled: boolean) => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('apps', 'update');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      appKey,
      enabled,
    } as UpdateSpaceAppsBody),
  });
};

export interface UpdateSpaceAppSyncBody {
  spaceName: string;
  participantId: string;
  sync: AppKey;
}

export const updateSpaceAppSync = async (
  spaceName: string,
  participantId: string,
  sync: AppKey
) => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('apps', 'sync');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      participantId,
      sync,
    } as UpdateSpaceAppSyncBody),
  });
};

export interface UpdateSpaceAppAuthBody {
  spaceName: string;
  participantId: string;
  appAuth: AppAuth;
}

export const updateSpaceAppAuth = async (
  spaceName: string,
  participantId: string,
  appAuth: AppAuth,
) => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('apps', 'auth');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      participantId,
      appAuth,
    } as UpdateSpaceAppAuthBody),
  });
};

export const leaveSpace = async (spaceName: string, removeId: string, socket: Socket) => {
  const response = await deleteSpaceParticipant(spaceName, removeId);
  if (!response.ok) {
    // console.error('Failed to leave space:', spaceName, 'with ID:', removeId);
  } else {
    const data: { success: boolean; clearSpace?: string } = await response.json();
    if (data.clearSpace && data.clearSpace === spaceName) {
      // 说明是最后一个人离开了，清理空间所有资源
      socket.emit('clear_space_resources', { spaceName: data.clearSpace });
    }
  }
};

export interface PersistentSpaceBody {
  spaceName: string;
  persistence: boolean;
}

export const persistentSpace = async (spaceName: string, persistence: boolean) => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('space', 'true');
  url.searchParams.append('persistence', 'update');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spaceName, persistence } as PersistentSpaceBody),
  });
};

export interface UploadSpaceAppBody {
  spaceName: string;
  participantId: string;
  data: SpaceTimer | SpaceCountdown | SpaceTodo;
  ty: AppKey;
}

export const uploadSpaceApp = async (
  spaceName: string,
  participantId: string,
  ty: AppKey,
  data: SpaceTimer | SpaceCountdown | SpaceTodo,
) => {
  const url = new URL(SPACE_API, window.location.origin);
  url.searchParams.append('apps', 'upload');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      data,
      participantId,
      ty,
    } as UploadSpaceAppBody),
  });
};
