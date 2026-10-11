import {
  HandleFileSystemType,
  HandleFileSystemBody,
  HandleTilePlayerFileBody as TilePlayerBody,
} from '@vocespace/domain/requests/chat';
export * from '@vocespace/domain/requests/chat';
import { apiFetch } from '@/lib/api/client';
import { getWebClient } from '@/lib/api/client';
import { LocalParticipant } from 'livekit-client';
import { connect_endpoint, FileType } from '@/lib/std/index';

export const fetchLinkPreview = async (text: string) => {
  const url = new URL(connect_endpoint('/api/chat'), window.location.origin);
  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: text }),
  });
};

/**
 * 获取某个空间的聊天记录
 * @param spaceName 空间名称
 * @returns
 */
export const getChatMsg = async (spaceName: string) => {
  return getWebClient().chat.history(spaceName);
};

export const uploadFile = async (
  file: FileType,
  space: string,
  localParticipant:
    | LocalParticipant
    | {
        identity: string;
        name?: string;
      },
  abortController?: AbortController,
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('roomName', space);
  formData.append('senderId', localParticipant.identity);
  formData.append('senderName', localParticipant.name || localParticipant.identity);

  return await apiFetch(connect_endpoint('/api/upload'), {
    method: 'POST',
    body: formData,
    signal: abortController?.signal, // 添加取消信号
  });
};

/**
 * 处理文件系统操作
 * @param spaceName
 * @param ty
 * @param fileName
 * @returns
 * 1. ls: `{files: string[]}`
 * 2. rm, rm -a: `{success: true}`
 * 3. download: `{fileUrl: string}`
 */
export const handleFileSystem = async (
  spaceName: string,
  ty: HandleFileSystemType,
  fileName?: string,
) => {
  const url = new URL(connect_endpoint('/api/upload'), window.location.origin);
  url.searchParams.append('action', 'fs');
  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ spaceName, ty, fileName }),
  });
};

export const handleTilePlayerFile = async (
  spaceName: string,
  room?: string,
  ty?: HandleFileSystemType | 'set_meta' | 'create_hyperbeam' | 'create_whiteboard',
  file?: FileType,
  iframeUrl?: string,
  identity?: string,
  playerId?: string,
) => {
  const url = new URL(connect_endpoint('/api/upload'), window.location.origin);
  url.searchParams.append('tilePlayer', 'true');

  // upload 操作不能用 JSON（File 对象无法序列化），改用 FormData
  if (ty === 'upload' && file) {
    const formData = new FormData();
    formData.append('spaceName', spaceName);
    formData.append('ty', ty);
    if (room) formData.append('room', room);
    if (identity) formData.append('identity', identity);
    formData.append('file', file as File);
    return await apiFetch(url.toString(), {
      method: 'POST',
      body: formData,
    });
  }

  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      spaceName,
      ty: ty || 'ls',
      room,
      iframeUrl,
      identity,
      playerId,
    } as Omit<HandleTilePlayerFileBody, 'file'>),
  });
};

export type HandleTilePlayerFileBody = TilePlayerBody<FileType>;
