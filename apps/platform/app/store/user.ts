import { create } from "zustand";
import { UserInfo } from "@/lib/std/user";
import { Nullable } from "@/lib/std";

export interface UserStore {
  userInfo: Nullable<UserInfo>;
  setUserInfo: (userInfo: Nullable<UserInfo>) => void;
  mergeUserInfo: (updates: Partial<UserInfo>) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  userInfo: null,
  setUserInfo: (userInfo: Nullable<UserInfo>) => set({ userInfo }),
  mergeUserInfo: (updates: Partial<UserInfo>) => {
    set((state) => ({
      userInfo: state.userInfo ? { ...state.userInfo, ...updates } : null,
    }));
  },
}));
