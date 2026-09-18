'use client';

import { ulid } from 'ulid';

import { ChatPanelProps, EnhancedChatExports } from '@/features/chat/shared';
import { api } from '@/lib/api';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { useVisualViewport } from '@/lib/hooks/use-visual-viewport';
import { useI18n } from '@/lib/i18n/i18n';
import { socket } from '@/lib/realtime/socket';
import { FileType } from '@/lib/std';
import { ChatMsgItem } from '@/lib/std/chat';
import { handleIdentityType } from '@/lib/std/space';
import { useRoomStore } from '@/lib/store';
import { useLocalParticipant } from '@livekit/components-react';
import * as React from 'react';

export function useChat({ space, sendFileConfirm, messageApi, spaceInfo, onClose }: ChatPanelProps, ref: React.ForwardedRef<EnhancedChatExports>) {
  const device = useLayoutDevice();
  const viewport = useVisualViewport(device === 'phone');
  const { t } = useI18n();
  const ulRef = React.useRef<HTMLUListElement>(null);
  const bottomRef = React.useRef<HTMLLIElement>(null);
  const chatMsg = useRoomStore((s) => s.chatMsg);
  const [value, setValue] = React.useState('');
  const [isComposing, setIsComposing] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const dragCounterRef = React.useRef(0);
  const [fsModal, setFsModal] = React.useState(false);
  const [files, setFiles] = React.useState<string[]>([]);
  const canDeleteRBAC = React.useMemo(() => {
    if (!spaceInfo?.auth) return false;

    let auth = handleIdentityType(
      spaceInfo.participants[space?.localParticipant.identity]?.auth?.identity || 'guest',
    );
    return spaceInfo.auth[auth]?.manageFile || false;
  }, [spaceInfo?.auth, spaceInfo?.participants, space?.localParticipant.identity]);
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;

    // 检查是否拖拽的是文件
    if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
      setDragOver(true);
    }
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;

    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragOver(false);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragOver(false);
  };
  React.useEffect(() => {
    useRoomStore.getState().setChatMsg((prev) => ({
      unhandled: 0,
      msgs: prev.msgs,
    }));

    if (bottomRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      });
    }
  }, [bottomRef]);
  const sendMsg = async () => {
    const msg = value.trim();
    if (msg === '') {
      return;
    }

    const newMsg: ChatMsgItem = {
      id: ulid(),
      sender: {
        id: space.localParticipant.identity,
        name: space.localParticipant.name || space.localParticipant.identity,
      },
      message: msg,
      type: 'text',
      roomName: space.name,
      file: null,
      timestamp: Date.now(),
    };

    useRoomStore.getState().setChatMsg((prev) => ({
      unhandled: prev.unhandled,
      msgs: [...prev.msgs, newMsg],
    }));
    setValue('');
    socket.emit('chat_msg', newMsg);
  };
  const handleBeforeUpload = (file: FileType) => {
    // 检查文件大小限制（建议限制为 10MB）
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxFileSize) {
      messageApi.error({
        content: t('msg.error.file.too_large') + ' 100MB',
        duration: 3,
      });
      return false;
    }

    sendFileConfirm(async (abortController?: AbortController): Promise<ChatMsgItem> => {
      try {
        let fileMessage: ChatMsgItem;
        if (file.size > 1 * 1024 * 1024) {
          fileMessage = await handleLargeFileUpload(file, abortController);
        } else {
          fileMessage = await handleSmallFileUpload(file);
        }
        // 广播给其他用户，服务端会处理文件保存并广播 chat_file_response 给所有人
        socket.emit('chat_file', fileMessage);
        return fileMessage;
      } catch (e) {
        messageApi.error({
          content: `${t('msg.error.file.upload')}: ${e}`,
          duration: 3,
        });
        console.error('Error uploading file:', e);
        return Promise.reject(e);
      }
    });
    return false; // 阻止自动上传
  };
  const handleSmallFileUpload = async (file: FileType): Promise<ChatMsgItem> => {
    return new Promise<ChatMsgItem>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileData = e.target?.result;
        console.log('Small file upload:', file.size, file.name, file.type);

        const fileMessage: ChatMsgItem = {
          sender: {
            id: localParticipant.identity,
            name: localParticipant.name || localParticipant.identity,
          },
          message: null,
          type: 'file',
          roomName: space.name,
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
  const handleLargeFileUpload = async (
    file: FileType,
    abortController?: AbortController,
  ): Promise<ChatMsgItem> => {
    try {
      const response = await api.uploadFile(file, space.name, localParticipant, abortController);

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
          id: localParticipant.identity,
          name: localParticipant.name || localParticipant.identity,
        },
        message: `file: ${file.name}`,
        type: 'file',
        roomName: space.name,
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
  const scrollToBottom = () => {
    // 使用 scrollIntoView，更可靠
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
      inline: 'nearest',
    });
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 回车发送消息，Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey && !isComposing && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      sendMsg();
    }
  };
  const { localParticipant } = useLocalParticipant();
  const isLocal = (identity?: string): boolean => {
    if (identity) {
      console.log('localParticipant', identity, localParticipant.identity);
      return localParticipant.identity === identity;
    } else {
      return false;
    }
  };
  const isImg = (type: string) => {
    return type.startsWith('image/');
  };
  const downloadFile = async (url?: string) => {
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = url.split('/').pop() || 'file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      messageApi.error({
        content: t('msg.error.file.download'),
        duration: 1,
      });
    }
  };
  React.useLayoutEffect(() => {
    scrollToBottom();
  }, [chatMsg.msgs, device, viewport?.height]);
  const openLocalFileSystem = async (fresh?: boolean) => {
    const response = await api.handleFileSystem(space.name, 'ls');
    if (response.ok) {
      const { files }: { files: string[] } = await response.json();
      setFiles(files);
    }
    // 不更新才打开
    if (!fresh) {
      setFsModal(true);
    }
  };
  return {
    viewport,
    space,
    sendFileConfirm,
    messageApi,
    spaceInfo,
    onClose,
    ref,
    t,
    ulRef,
    bottomRef,
    chatMsg,
    value,
    setValue,
    isComposing,
    setIsComposing,
    dragOver,
    setDragOver,
    dragCounterRef,
    fsModal,
    setFsModal,
    files,
    setFiles,
    canDeleteRBAC,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    sendMsg,
    handleBeforeUpload,
    handleSmallFileUpload,
    handleLargeFileUpload,
    scrollToBottom,
    handleKeyDown,
    localParticipant,
    isLocal,
    isImg,
    downloadFile,
    openLocalFileSystem,
    device,
  };
}
