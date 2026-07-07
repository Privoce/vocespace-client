import { create } from 'zustand';
import { UserDefineStatus } from '@/lib/std';
import { ChatMsgItem } from '@/lib/std/chat';
import { AppAuth } from '@/lib/std/space';

export interface RemoteApp {
  participantId: string | undefined;
  participantName: string | undefined;
  auth: AppAuth;
}

export interface ChatMsgState {
  msgs: ChatMsgItem[];
  unhandled: number;
}

interface RoomState {
  /** 房间自定义状态列表 */
  roomStatusList: UserDefineStatus[];
  /** 聊天消息 */
  chatMsg: ChatMsgState;
  /** 虚拟形象遮罩 */
  virtualMask: boolean;
  /** 远程应用目标 */
  remoteApp: RemoteApp;

  setRoomStatusList: (list: UserDefineStatus[]) => void;
  setChatMsg: (chatMsg: ChatMsgState | ((prev: ChatMsgState) => ChatMsgState)) => void;
  setVirtualMask: (v: boolean) => void;
  setRemoteApp: (app: Partial<RemoteApp>) => void;
}

export const useRoomStore = create<RoomState>()((set) => ({
  roomStatusList: [],
  chatMsg: { msgs: [], unhandled: 0 },
  virtualMask: false,
  remoteApp: {
    participantId: undefined,
    participantName: undefined,
    auth: 'read' as AppAuth,
  },

  setRoomStatusList: (roomStatusList) => set({ roomStatusList }),
  setChatMsg: (chatMsg) =>
    set(
      typeof chatMsg === 'function'
        ? (s) => ({ chatMsg: (chatMsg as (prev: ChatMsgState) => ChatMsgState)(s.chatMsg) })
        : { chatMsg },
    ),
  setVirtualMask: (virtualMask) => set({ virtualMask }),
  setRemoteApp: (partial) => set((s) => ({ remoteApp: { ...s.remoteApp, ...partial } })),
}));
