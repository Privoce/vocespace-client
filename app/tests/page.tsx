'use client';

// 必须最先导入：lib/api(index) ↔ lib/std 存在循环引用，
// 若首个触达该簇的是子模块（如 Controller 链路中的组件引 @/lib/api/*），
// 会触发 TDZ 错误 "Cannot access 'fetchLinkPreview' before initialization"
import '@/lib/api';

/**
 * Controls（Control Bar）单页测试
 * 仅用于 /tests 页面：mock ControlBarProps 所需数据，不依赖真实 LiveKit 连接、socket 与后端接口
 *
 * mock 范围：
 * - Room：真实 new Room() 但不连接，包在 RoomContext.Provider 中（localParticipant 注入 identity/name/permissions）
 * - spaceInfo：DEFAULT_SPACE_INFO + ownerId 指向本地参与者（isManager=true 分支）
 * - 所有 ControlBarProps 回调（updateSettings/updateRecord/fetchSettings 等）均只打日志 + message 提示
 *
 * 支持交互：
 * - 控制条按钮：麦克风/摄像头/屏幕分享（微信内会显示不可用提示）、聊天（含未读徽标）、更多菜单、离开
 * - 工具栏快捷入口：打开设置抽屉（general/license）、未读消息 +3/清零、openApp 状态切换
 * - 更多菜单 → 成员管理 / 分享邀请 / 修改名称 / 录制弹窗（记录类 API 均为 mock 或失败降级）
 * - phone 分支：浏览器窗口缩窄到 <768px 自动切换（useLayoutDevice 基于 matchMedia）
 *
 * 预期控制台噪音：
 * - socket 模块静态导入导致的连接失败日志
 * - 录制/设置面板内真实 api 调用失败（网络错误 toast + console error），不影响 UI 测试
 */

import { Controls } from '@/components/Controller';
import type { ControlBarProps, ControlBarExport } from '@/components/Controller/types';
import { RoomContext } from '@livekit/components-react';
import { Room } from 'livekit-client';
import { DEFAULT_SPACE_INFO, DEFAULT_PARTICIPANT_SETTINGS } from '@/lib/std/space';
import type { ReadableConf } from '@/lib/std/conf';
import { useRoomStore } from '@/lib/store';
import { Button, Space, message } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import * as React from 'react';

// ---------------------------------- mock 常量 ----------------------------------

const LOCAL_ID = 'local-user';
const MOCK_SPACE_NAME = 'test-space';

const MOCK_CONFIG = {
  livekit: { url: 'wss://mock-livekit.example.com', apiKey: 'mock', apiSecret: 'mock' },
  serverUrl: 'https://mock.vocespace.com',
  license: 'mock-license',
  create_space: 'all',
} as unknown as ReadableConf;

// ---------------------------------- 测试页 ----------------------------------

export default function Page() {
  const [messageApi, contextHolder] = message.useMessage() as [MessageInstance, React.ReactNode];

  const [openApp, setOpenApp] = React.useState(false);
  const controlsRef = React.useRef<ControlBarExport>(null);

  const log = (action: string, ...args: unknown[]) => console.warn(`[ControlsTest] ${action}`, ...args);

  // 真实 Room 实例（不连接）：注入 name / localParticipant 身份与权限
  // - setPermissions 仅改本地状态（不触 engine），未连接时安全
  // - permissions 有值才能让 useLocalParticipantPermissions 生效，麦克风/摄像头/屏幕分享按钮才会渲染
  const mockSpace = React.useMemo(() => {
    const room = new Room();
    Object.defineProperty(room, 'name', { value: MOCK_SPACE_NAME, configurable: true });
    const lp = room.localParticipant;
    Object.defineProperty(lp, 'identity', { value: LOCAL_ID, configurable: true });
    Object.defineProperty(lp, 'name', { value: 'Local User', configurable: true });
    lp.setPermissions({
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: [],
      hidden: false,
      recorder: false,
      canUpdateMetadata: true,
      canSubscribeMetrics: false,
      agent: false,
    } as unknown as Parameters<Room['localParticipant']['setPermissions']>[0]);
    return room;
  }, []);

  // DEFAULT_SPACE_INFO：record/ai/auth/work 均有默认值；ownerId 指向本地参与者 → isManager 分支
  const mockSpaceInfo = React.useMemo(() => {
    const si = DEFAULT_SPACE_INFO(Date.now(), true);
    si.ownerId = LOCAL_ID;
    si.participants[LOCAL_ID] = {
      ...DEFAULT_PARTICIPANT_SETTINGS,
      name: 'Local User',
      socketId: 'mock-socket-id',
      startAt: Date.now(),
      online: true,
    };
    return si;
  }, []);

  // 所有触碰 API/socket 的回调一律 mock
  const controlProps = {
    updateSettings: async (newSettings: Record<string, unknown>) => {
      log('updateSettings', newSettings);
      messageApi.info({ content: '[mock] updateSettings', duration: 2 });
      return true;
    },
    setUserStatus: async (status: string) => log('setUserStatus', status),
    spaceInfo: mockSpaceInfo,
    fetchSettings: async () => {
      log('fetchSettings');
      messageApi.info({ content: '[mock] fetchSettings', duration: 2 });
    },
    updateRecord: async (active: boolean, egressId?: string, filePath?: string) => {
      log('updateRecord', active, egressId, filePath);
      return true;
    },
    setPermissionDevice: (device: unknown) => log('setPermissionDevice', device),
    openApp,
    setOpenApp,
    toRenameSettings: () => log('toRenameSettings'),
    startOrStopAICutAnalysis: async (freq: number, conf: unknown, reload?: boolean) =>
      log('startOrStopAICutAnalysis', freq, conf, reload),
    openAIServiceAskNote: () => {
      log('openAIServiceAskNote');
      messageApi.info({ content: '[mock] openAIServiceAskNote', duration: 2 });
    },
    downloadAIMdReport: async () => log('downloadAIMdReport'),
    config: MOCK_CONFIG,
    controls: { chat: true },
    saveUserChoices: false,
  } as ControlBarProps;

  return (
    <RoomContext.Provider value={mockSpace}>
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
          wrap
        >
          <span>Controls Test</span>
          <Button
            size="small"
            onClick={() => controlsRef.current?.openSettings('general')}
          >
            设置·通用
          </Button>
          <Button
            size="small"
            onClick={() => controlsRef.current?.openSettings('license')}
          >
            设置·License
          </Button>
          <Button
            size="small"
            onClick={() =>
              useRoomStore.setState({ chatMsg: { unhandled: 3, msgs: [] } })
            }
          >
            未读消息 +3
          </Button>
          <Button
            size="small"
            onClick={() => useRoomStore.setState({ chatMsg: { unhandled: 0, msgs: [] } })}
          >
            清零未读
          </Button>
          <Button size="small" onClick={() => setOpenApp((v) => !v)}>
            openApp: {String(openApp)}
          </Button>
          <span style={{ color: '#888', fontSize: 12 }}>
            窗口缩窄至 &lt;768px 切换 phone 分支；API 均为 mock/失败降级
          </span>
        </Space>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '24px 16px',
            overflow: 'hidden',
          }}
        >
          <div style={{ maxWidth: 960, width: '100%', margin: '0 auto' }}>
            <Controls {...controlProps} ref={controlsRef} />
          </div>
        </div>
      </div>
    </RoomContext.Provider>
  );
}
