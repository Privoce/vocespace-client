'use client';

// 必须最先导入：lib/api(index) ↔ lib/std 存在循环引用，
// 若首个触达该簇的是子模块（如 fs.tsx 引 @/lib/api/chat），
// 会触发 TDZ 错误 "Cannot access 'fetchLinkPreview' before initialization"
import '@/lib/api';

/**
 * ChatPanel 单页测试
 * 仅用于 /tests 页面：mock ChatPanelModel 所需数据，不依赖真实 LiveKit 连接、socket 与后端接口
 * - 设备切换（pc/phone，phone 走 Drawer 分支）
 * - 消息列表（本地/远程文本、文件、图片、时间分割线）
 * - 发送/上传/拖拽/文件系统弹窗交互（全部为本地 mock，不发起请求）
 */

import { ChatPanelPC, type ChatPanelModel } from '@/components/Chat/pc';
import { ChatPanelPhone } from '@/components/Chat/phone';
import { useI18n } from '@/lib/i18n/i18n';
import type { ChatMsgItem } from '@/lib/std/chat';
import { Button, Radio, Space, message } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import { Room } from 'livekit-client';
import * as React from 'react';
import { ulid } from 'ulid';

// ---------------------------------- mock 常量 ----------------------------------

const LOCAL_ID = 'local-user';
const MOCK_SPACE_NAME = 'test-space';

const buildMockMsgs = (): ChatMsgItem[] => {
  const now = Date.now();
  return [
    {
      id: ulid(),
      sender: { id: 'alice', name: 'Alice' },
      message: '大家好，会议开始了',
      type: 'text',
      roomName: MOCK_SPACE_NAME,
      file: null,
      timestamp: now - 15 * 60 * 1000,
    },
    {
      id: ulid(),
      sender: { id: 'bob', name: 'Bob' },
      message: '收到，需求文档我看一下',
      type: 'text',
      roomName: MOCK_SPACE_NAME,
      file: null,
      timestamp: now - 14 * 60 * 1000,
    },
    {
      id: ulid(),
      sender: { id: 'alice', name: 'Alice' },
      message: null,
      type: 'file',
      roomName: MOCK_SPACE_NAME,
      file: { name: 'requirements.pdf', size: 1024 * 1024 * 3, type: 'application/pdf' },
      timestamp: now - 4 * 60 * 1000,
    },
    {
      id: ulid(),
      sender: { id: 'carol', name: 'Carol' },
      message: null,
      type: 'file',
      roomName: MOCK_SPACE_NAME,
      file: { name: 'screenshot.png', size: 1024 * 256, type: 'image/png' },
      timestamp: now - 3 * 60 * 1000,
    },
    {
      id: ulid(),
      sender: { id: LOCAL_ID, name: 'Local User' },
      message: '这个方案没问题，就按这个来 👍',
      type: 'text',
      roomName: MOCK_SPACE_NAME,
      file: null,
      timestamp: now - 2 * 60 * 1000,
    },
    {
      id: ulid(),
      sender: { id: 'bob', name: 'Bob' },
      message: 'ok，那我先出原型稿',
      type: 'text',
      roomName: MOCK_SPACE_NAME,
      file: null,
      timestamp: now - 1 * 60 * 1000,
    },
  ];
};

const MOCK_FILES = ['uploads/requirements.pdf', 'uploads/screenshot.png', 'uploads/demo.mp4'];

// ---------------------------------- 测试页 ----------------------------------

export default function Page() {
  const { t } = useI18n();
  const [messageApi, contextHolder] = message.useMessage() as [MessageInstance, React.ReactNode];

  // 设备模拟
  const [device, setDevice] = React.useState<'pc' | 'phone'>('pc');
  const [msgs, setMsgs] = React.useState<ChatMsgItem[]>(buildMockMsgs);
  const [value, setValue] = React.useState('');
  const [isComposing, setIsComposing] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const dragCounterRef = React.useRef(0);
  const [fsModal, setFsModal] = React.useState(false);
  const [files, setFiles] = React.useState<string[]>([]);
  const ulRef = React.useRef<HTMLUListElement>(null);
  const bottomRef = React.useRef<HTMLLIElement>(null);

  const log = (action: string, ...args: unknown[]) =>
    console.warn(`[ChatTest] ${action}`, ...args);

  // mock Room：仅用于 FS 弹窗的 space.name
  const mockSpace = React.useMemo(
    () => ({ name: MOCK_SPACE_NAME }) as unknown as Room,
    [],
  );

  const sendMsg = async () => {
    const msg = value.trim();
    if (msg === '') return;
    const newMsg: ChatMsgItem = {
      id: ulid(),
      sender: { id: LOCAL_ID, name: 'Local User' },
      message: msg,
      type: 'text',
      roomName: MOCK_SPACE_NAME,
      file: null,
      timestamp: Date.now(),
    };
    setMsgs((prev) => [...prev, newMsg]);
    log('sendMsg', msg);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !isComposing &&
      !e.nativeEvent.isComposing &&
      e.keyCode !== 229
    ) {
      e.preventDefault();
      sendMsg();
    }
  };

  const handleBeforeUpload = (file: { name: string; size: number; type: string }) => {
    log('handleBeforeUpload (mock)', file.name);
    const fileMessage: ChatMsgItem = {
      id: ulid(),
      sender: { id: LOCAL_ID, name: 'Local User' },
      message: null,
      type: 'file',
      roomName: MOCK_SPACE_NAME,
      file: { name: file.name, size: file.size, type: file.type },
      timestamp: Date.now(),
    };
    setMsgs((prev) => [...prev, fileMessage]);
    messageApi.info({ content: `[mock] uploaded: ${file.name}`, duration: 2 });
    return false;
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
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

  const openLocalFileSystem = async (fresh?: boolean) => {
    log('openLocalFileSystem (mock)');
    setFiles(MOCK_FILES);
    if (!fresh) {
      setFsModal(true);
    }
  };

  const isLocal = (identity?: string): boolean => (identity ? identity === LOCAL_ID : false);
  const isImg = (type: string) => type.startsWith('image/');
  const downloadFile = async (url?: string) => log('downloadFile', url);

  // phone 分支需要 viewport（mock 视口）
  const viewport =
    device === 'phone' && typeof window !== 'undefined'
      ? { height: window.innerHeight, top: 0 }
      : undefined;

  const model = {
    viewport,
    space: mockSpace,
    sendFileConfirm: (confirm: () => Promise<ChatMsgItem>) => {
      log('sendFileConfirm (mock)');
      confirm()
        .then((m) => setMsgs((prev) => [...prev, m]))
        .catch((e) => log('upload failed', e));
    },
    messageApi,
    spaceInfo: undefined,
    onClose: () => log('onClose'),
    ref: null,
    t,
    ulRef,
    bottomRef,
    chatMsg: { unhandled: 0, msgs },
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
    canDeleteRBAC: true,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    sendMsg,
    handleBeforeUpload,
    handleKeyDown,
    localParticipant: { identity: LOCAL_ID, name: 'Local User' },
    isLocal,
    isImg,
    downloadFile,
    openLocalFileSystem,
    device,
  } as unknown as ChatPanelModel;

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#141414',
      }}
    >
      {contextHolder}
      <Space
        style={{ padding: '12px 16px', borderBottom: '1px solid #2a2a2a', color: '#fff' }}
      >
        <span>ChatPanel Test</span>
        <Radio.Group
          value={device}
          onChange={(e) => setDevice(e.target.value)}
          options={[
            { label: 'PC', value: 'pc' },
            { label: 'Phone', value: 'phone' },
          ]}
          optionType="button"
          size="small"
        />
        <Button size="small" onClick={() => setMsgs(buildMockMsgs())}>
          重置消息
        </Button>
        <span style={{ color: '#888', fontSize: 12 }}>交互均为本地mock，无真实请求</span>
      </Space>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {device === 'pc' ? (
          <div
            style={{
              width: 300,
              height: 560,
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <ChatPanelPC model={model} />
          </div>
        ) : (
          <ChatPanelPhone model={model} />
        )}
      </div>
    </div>
  );
}
