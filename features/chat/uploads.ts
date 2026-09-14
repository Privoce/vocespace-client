import { ChatMsgItem } from '@/features/chat/types';
import { uploadFile } from '@/features/chat/api';
import type { FileType } from '@/lib/components/props';
// 处理大文件上传（通过 HTTP API）
export const handleLargeFileUpload = async (
  file: FileType,
  params: {
    spaceName: string;
    participantIdentity: string;
    participantName: string;
  },
  abortController?: AbortController,
): Promise<ChatMsgItem> => {
  try {
    const response = await uploadFile(
      file,
      params.spaceName,
      { identity: params.participantIdentity, name: params.participantName },
      abortController,
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Large file upload success:', result);

    // 创建文件消息，使用服务器返回的 URL
    let timestamp = Date.now();
    const fileMessage: ChatMsgItem = {
      id: timestamp.toString(),
      sender: {
        id: params.participantIdentity,
        name: params.participantName || params.participantIdentity,
      },
      message: `file: ${file.name}`,
      type: 'file',
      roomName: params.spaceName,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        url: result.fileUrl, // 使用文件服务 API
      },
      timestamp,
    };
    return fileMessage;
  } catch (error) {
    console.error('Large file upload failed:', error);
    throw error;
  }
};


// 处理小文件上传（通过 Socket）
export const handleSmallFileUpload = async (
  file: FileType,
  params: {
    spaceName: string;
    participantIdentity: string;
    participantName: string;
  },
): Promise<ChatMsgItem> => {
  return new Promise<ChatMsgItem>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = e.target?.result;
      console.log('Small file upload:', file.size, file.name, file.type);

      const fileMessage: ChatMsgItem = {
        sender: {
          id: params.participantIdentity,
          name: params.participantName || params.participantIdentity,
        },
        message: null,
        type: 'file',
        roomName: params.spaceName,
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
          data: fileData,
        },
        timestamp: Date.now(),
      };

      // 发送文件消息
      // socket.emit('chat_file', fileMessage);
      resolve(fileMessage);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
};
