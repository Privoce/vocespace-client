'use client';

/**
 * ChannelSurface 单页测试
 * 仅用于 /tests 页面：mock ChannelModel 所需数据，不依赖真实 LiveKit 连接与后端接口
 * - 设备切换（pc/phone）
 * - 子房间列表（公开/私密/有成员）
 * - 创建/重命名/分享/反馈等弹窗交互（全部为本地 mock，不发起请求）
 */

import { ChannelSurface } from '@/components/Channel';
import type { ChannelModel } from '@/components/Channel/content';
import type { FeedbackType, FeedbackUploadItem, RoomPrivacy } from '@/components/Channel/types';
import { useI18n } from '@/lib/i18n/i18n';
import { encodeChildRoomEnter } from '@/lib/std';
import type { ReadableConf } from '@/lib/std/conf';
import {
  DEFAULT_PARTICIPANT_SETTINGS,
  DEFAULT_SPACE_WORK_CONF,
  type ChildRoom,
  type ParticipantSettings,
  type SpaceAuthConf,
  type SpaceInfo,
} from '@/lib/std/space';
import { RoomContext, type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import type { MenuProps } from 'antd';
import { Button, Form, Radio, Space, Switch, theme, message } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import { Room, type RemoteParticipant } from 'livekit-client';
import { useRef, useState } from 'react';

// ---------------------------------- mock 常量 ----------------------------------

const LOCAL_ID = 'local-user';
const MOCK_SPACE_NAME = 'test-space';

const mockParticipant = (id: string, name: string, online = true): ParticipantSettings => {
  const p = {
    ...DEFAULT_PARTICIPANT_SETTINGS,
    name,
    online,
    socketId: `socket-${id}`,
    blur: 0,
  } as ParticipantSettings;
  return p;
};

const mockChildRooms: ChildRoom[] = [
  { name: 'design', participants: ['alice', 'bob'], ownerId: LOCAL_ID, isPrivate: false },
  { name: 'secret-room', participants: [], ownerId: LOCAL_ID, isPrivate: true },
  { name: 'group-chat', participants: ['carol'], ownerId: 'alice', isPrivate: false },
];

const mockSettings: SpaceInfo = {
  participants: {
    [LOCAL_ID]: mockParticipant(LOCAL_ID, 'Local User'),
    alice: mockParticipant('alice', 'Alice'),
    bob: mockParticipant('bob', 'Bob'),
    carol: mockParticipant('carol', 'Carol'),
  },
  ownerId: LOCAL_ID,
  managers: [],
  allowGuest: 'allow',
  record: { active: false },
  startAt: Math.floor(Date.now() / 1000),
  children: mockChildRooms,
  apps: [],
  persistence: false,
  ai: { cut: { enabled: false, freq: 5 } },
  work: DEFAULT_SPACE_WORK_CONF,
  auth: {
    owner: {
      viewRoom: true,
      createRoom: true,
      manageRoom: true,
      manageRole: true,
      controlUser: true,
      recording: true,
      manageFile: true,
      managePlayer: true,
    },
    manager: {
      viewRoom: true,
      createRoom: true,
      manageRoom: true,
      manageRole: false,
      controlUser: true,
      recording: true,
      manageFile: true,
      managePlayer: true,
    },
    participant: {
      viewRoom: true,
      createRoom: true,
      manageRoom: false,
      manageRole: false,
      controlUser: false,
      recording: false,
      manageFile: false,
      managePlayer: false,
    },
    guest: {
      viewRoom: true,
      createRoom: false,
      manageRoom: false,
      manageRole: false,
      controlUser: false,
      recording: false,
      manageFile: false,
      managePlayer: false,
    },
  } as SpaceAuthConf,
};

const mockConfig: ReadableConf = {
  livekit: { url: 'ws://localhost:7880', key: 'devkey', secret: 'devsecret' },
  serverUrl: 'localhost:3000',
  license: 'mock-license',
  create_space: 'all',
};

// 占位 track refs（无真实媒体流），仅用于验证 Tile 渲染
const buildMockTracks = (): TrackReferenceOrPlaceholder[] =>
  ['alice', 'bob'].map((id) => ({
    participant: {
      identity: id,
      name: mockSettings.participants[id].name,
    } as unknown as RemoteParticipant,
    publication: undefined,
    source: 'camera',
  })) as TrackReferenceOrPlaceholder[];

// ---------------------------------- 测试页 ----------------------------------

export default function Page() {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const [messageApi, contextHolder] = message.useMessage() as [MessageInstance, React.ReactNode];

  // 设备模拟
  const [device, setDevice] = useState<'pc' | 'phone'>('pc');
  // 是否渲染占位参与者 Tile（依赖 mock Room context）
  const [showTiles, setShowTiles] = useState(false);

  // mock Room：不连接，仅提供 RoomContext / space.name
  const [mockRoom] = useState(() => {
    const r = new Room();
    Object.defineProperty(r, 'name', { value: MOCK_SPACE_NAME, configurable: true });
    return r;
  });

  // 交互状态（对齐 useChannelState 中的真实 state）
  const [collapsed, setCollapsed] = useState(false);
  const [roomCreateModalOpen, setRoomCreateModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ChildRoom | null>(null);
  const [mainJoinVis, setMainJoinVis] = useState<'hidden' | 'visible'>('hidden');
  const [roomJoinVis, setRoomJoinVis] = useState<number | null>(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [shareRoomOpen, setShareRoomOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [feedbackUploading, setFeedbackUploading] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackUploads, setFeedbackUploads] = useState<FeedbackUploadItem[]>([]);
  const [renameRoomName, setRenameRoomName] = useState('');
  const [childRoomName, setChildRoomName] = useState('');
  const [subActiveKey, setSubActiveKey] = useState<string[]>(['design', 'group-chat']);
  const [mainActiveKey, setMainActiveKey] = useState<string[]>(['main', 'sub']);
  const [roomPrivacy, setRoomPrivacy] = useState<RoomPrivacy>('public');
  const [feedbackForm] = Form.useForm<{ email: string; otherType?: string; content: string }>();

  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mainHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const log = (action: string, ...args: unknown[]) =>
    console.warn(`[ChannelTest] ${action}`, ...args);

  const roomPrivacyOptions = [
    { label: t('channel.modal.privacy.public.title'), value: 'public' },
    { label: t('channel.modal.privacy.private.title'), value: 'private' },
  ];

  const feedbackTypeOptions = [
    { label: t('channel.feedback.types.bug'), value: 'bug' },
    { label: t('channel.feedback.types.error'), value: 'error' },
    { label: t('channel.feedback.types.question'), value: 'question' },
    { label: t('channel.feedback.types.suggestion'), value: 'suggestion' },
    { label: t('channel.feedback.types.other'), value: 'other' },
  ];

  const panelStyle: React.CSSProperties = {
    marginBottom: 0,
    background: '#1e1e1e',
    borderRadius: 0,
    border: 'none',
    padding: '0px',
  };
  const subStyle: React.CSSProperties = {
    marginBottom: 0,
    background: '#1e1e1e',
    borderRadius: 0,
    border: 'none',
  };

  const shareRoomToClipboard = (room?: string, spaceName?: string) => {
    const targetRoom = room ?? selectedRoom?.name;
    const targetSpace = spaceName ?? MOCK_SPACE_NAME;
    if (!targetRoom || !targetSpace) return;
    const url = `https://${mockConfig.serverUrl}/${targetSpace}?childRoomEnter=${encodeChildRoomEnter(
      targetSpace,
      targetRoom,
      mockRoom.localParticipant.identity,
    )}`;
    log('shareRoomToClipboard', url);
    navigator.clipboard
      .writeText(url)
      .then(() => messageApi.success({ content: t('common.copy.success') }))
      .catch((e) => log('clipboard error', e));
  };

  const createChildRoom = async () => {
    if (childRoomName.trim() === '') {
      messageApi.error({ content: t('channel.create.empty_name'), duration: 2 });
      return;
    }
    log('createChildRoom', childRoomName, roomPrivacy);
    messageApi.success({ content: `[mock] create room: ${childRoomName}`, duration: 2 });
    setRoomCreateModalOpen(false);
    setChildRoomName('');
  };

  const updateChildRoom = async (ty: string) => {
    log('updateChildRoom', ty, selectedRoom?.name);
    if (ty === 'name') {
      setRenameModalOpen(false);
      setRenameRoomName('');
      messageApi.success({ content: `[mock] rename -> ${renameRoomName}`, duration: 2 });
    }
  };

  const subContextItems: MenuProps['items'] = [
    {
      key: 'rename',
      label: t('channel.menu.rename'),
      onClick: () => setRenameModalOpen(true),
    },
    {
      key: 'share',
      label: t('channel.menu.share'),
      onClick: () => setShareRoomOpen(true),
    },
    {
      key: 'privacy',
      label: `${t('channel.menu.switch_privacy')}${!selectedRoom?.isPrivate
        ? t('channel.modal.privacy.private.title')
        : t('channel.modal.privacy.public.title')
      }`,
      onClick: () => log('switch privacy', selectedRoom?.name),
    },
    {
      key: 'delete',
      label: t('channel.menu.delete'),
      onClick: () => {
        log('delete room', selectedRoom?.name);
        setSelectedRoom(null);
      },
    },
    {
      key: 'leave',
      label: t('channel.menu.leave'),
      onClick: () => log('leave room', selectedRoom?.name),
    },
  ];

  const closeFeedbackModal = () => {
    setFeedbackOpen(false);
    feedbackForm.resetFields();
    setFeedbackType('bug');
    setFeedbackUploads([]);
    setFeedbackUploading(false);
    setFeedbackSubmitting(false);
  };

  const handleFeedbackUpload = async () => {
    log('handleFeedbackUpload (mock)');
    setFeedbackUploading(true);
    setTimeout(() => setFeedbackUploading(false), 800);
    return false;
  };

  const submitFeedback = async () => {
    const values = await feedbackForm.validateFields();
    log('submitFeedback', { ...values, feedbackType });
    messageApi.success({ content: '[mock] feedback submitted', duration: 2 });
    closeFeedbackModal();
  };

  const model = {
    // 基础 props
    space: mockRoom,
    config: mockConfig,
    settings: mockSettings,
    messageApi,
    localParticipantId: LOCAL_ID,
    onUpdate: async () => {},
    tracks: showTiles ? buildMockTracks() : [],
    isActive: true,
    updateSettings: async () => true,
    toRenameSettings: () => {},
    toSettings: () => {},
    setUserStatus: async () => {},
    showFlotApp: () => {},
    // 设备
    device,
    isMobile: device === 'phone',
    // i18n / theme
    t,
    token,
    // 布局状态
    collapsed,
    setCollapsed,
    isFullScreen: false,
    selected: 'main' as const,
    setSelected: () => {},
    // 主房间 hover/加入
    mainJoinVis,
    setMainJoinVis,
    roomJoinVis,
    setRoomJoinVis,
    mainHideTimeoutRef,
    hideTimeoutRef,
    // 子房间
    childRooms: mockChildRooms,
    subActiveKey,
    setSubActiveKey,
    mainActiveKey,
    setMainActiveKey,
    childRoomName,
    setChildRoomName,
    createRoom: true,
    manageRoom: true,
    roomCreateModalOpen,
    setRoomCreateModalOpen,
    selectedRoom,
    setSelectedRoom,
    renameModalOpen,
    setRenameModalOpen,
    renameRoomName,
    setRenameRoomName,
    shareRoomOpen,
    setShareRoomOpen,
    roomPrivacy,
    setRoomPrivacy,
    roomPrivacyOptions,
    createChildRoom,
    deleteChildRoom: async () => {},
    leaveChildRoom: async () => {},
    joinChildRoom: async () => {},
    addIntoRoom: async (room: ChildRoom) => {
      log('addIntoRoom', room.name);
      messageApi.info({ content: `[mock] join room: ${room.name}`, duration: 2 });
    },
    confirmJoinRoom: async () => {},
    joinMainRoom: async () => {
      log('joinMainRoom');
      messageApi.info({ content: '[mock] back to main room', duration: 2 });
    },
    updateChildRoom,
    authDisabled: false,
    subContextItems,
    panelStyle,
    subStyle,
    shareRoomToClipboard,
    // 加入请求弹窗（真实流程由 socket 触发，这里默认关闭）
    joinModalOpen: false,
    setJoinModalOpen: () => {},
    joinParticipant: null,
    setJoinParticipant: () => {},
    selfRoomName: MOCK_SPACE_NAME,
    setSelfRoomName: () => {},
    agreeJoinRoom: async () => {},
    // 参与者
    allParticipants: Object.keys(mockSettings.participants),
    subRoomsTmp: [],
    setSubRoomsTmp: () => {},
    wsSender: null,
    // 反馈
    feedbackOpen,
    setFeedbackOpen,
    feedbackType,
    setFeedbackType,
    feedbackUploading,
    setFeedbackSubmitting,
    feedbackSubmitting,
    feedbackUploads,
    setFeedbackUploads,
    feedbackForm,
    feedbackTypeOptions,
    resetFeedbackState: () => {},
    closeFeedbackModal,
    handleFeedbackUpload,
    submitFeedback,
    // actions
    createOwnSpace: async () => {
      log('createOwnSpace (mock)');
      messageApi.info({ content: '[mock] create own space', duration: 2 });
    },
    ref: null,
  } as unknown as ChannelModel;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#141414' }}>
      {contextHolder}
      <Space
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #2a2a2a',
          color: '#fff',
        }}
      >
        <span>ChannelSurface Test</span>
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
        <span>Tile占位:</span>
        <Switch size="small" checked={showTiles} onChange={setShowTiles} />
        <Button size="small" onClick={() => setCollapsed((v) => !v)}>
          toggleCollapse
        </Button>
        <Button size="small" type="primary" onClick={() => setFeedbackOpen(true)}>
          feedback
        </Button>
        <span style={{ color: '#888', fontSize: 12 }}>交互均为本地mock，无真实请求</span>
      </Space>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <RoomContext.Provider value={mockRoom}>
          <div style={{ width: 320, height: '100%' }}>
            <ChannelSurface model={model} />
          </div>
        </RoomContext.Provider>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
          }}
        >
          mock settings: {mockChildRooms.length} child rooms /{' '}
          {Object.keys(mockSettings.participants).length} participants
        </div>
      </div>
    </div>
  );
}
