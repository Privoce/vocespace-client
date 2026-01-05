import { LocalParticipant } from 'livekit-client';
import { connect_endpoint, FileType } from '../std';

export const fetchLinkPreview = async (text: string) => {
  const url = new URL(connect_endpoint('/api/chat'), window.location.origin);
  return await fetch(url.toString(), {
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
  const url = new URL(connect_endpoint('/api/space'), window.location.origin);
  url.searchParams.append('spaceName', spaceName);
  url.searchParams.append('chat', 'true');
  url.searchParams.append('history', 'true');
  return await fetch(url.toString());
};

export const uploadFile = async (
  file: FileType,
  space: string,
  localParticipant: LocalParticipant,
  abortController?: AbortController,
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('roomName', space);
  formData.append('senderId', localParticipant.identity);
  formData.append('senderName', localParticipant.name || localParticipant.identity);

  return await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    signal: abortController?.signal, // 添加取消信号
  });
};

/**
 * 处理文件系统操作
 * - rm: 删除文件
 * - download: 下载文件
 * - ls: 列出所有文件
 * - rm -a: 删除所有文件
 */
export type HandleFileSystemType = 'rm' | 'download' | 'ls' | 'rm -a';

export interface HandleFileSystemBody {
  spaceName: string;
  ty: HandleFileSystemType;
  fileName?: string;
}

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
) =>  {
  const url = new URL(connect_endpoint('/api/upload'), window.location.origin);
  url.searchParams.append('action', 'fs');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ spaceName, ty, fileName }),
  });
};
