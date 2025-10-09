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
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('roomName', space);
  formData.append('senderId', localParticipant.identity);
  formData.append('senderName', localParticipant.name || localParticipant.identity);

  return await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
};
