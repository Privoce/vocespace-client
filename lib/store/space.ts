import { create } from 'zustand';

interface SpaceState {
  /** 临时 room ID */
  roomIdTmp: string;
  setRoomIdTmp: (id: string) => void;
}

export const useSpaceStore = create<SpaceState>()((set) => ({
  roomIdTmp: '',
  setRoomIdTmp: (roomIdTmp) => set({ roomIdTmp }),
}));
