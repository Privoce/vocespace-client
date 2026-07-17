import { create } from 'zustand';
import { isMobile } from '@/lib/std';

interface SpaceState {
  /** 临时 room ID */
  roomIdTmp: string;
  setRoomIdTmp: (id: string) => void;
  /** 设备类型 */
  deviceType: 'mobile' | 'desktop';
  /** 侧边栏是否折叠 */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  isFocus: boolean;
  isFullScreen: boolean;
  setIsFocus: (isFocus: boolean) => void;
  setIsFullScreen: (isFullScreen: boolean) => void;
}

export const useSpaceStore = create<SpaceState>()((set) => ({
  roomIdTmp: '',
  setRoomIdTmp: (roomIdTmp) => set({ roomIdTmp }),
  deviceType: isMobile() ? 'mobile' : 'desktop',
  collapsed: isMobile(),
  setCollapsed: (collapsed) => set({ collapsed }),
  isFocus: false,
  isFullScreen: false,
  setIsFocus: (isFocus) => set({ isFocus }),
  setIsFullScreen: (isFullScreen) => set({ isFullScreen }),
}));
