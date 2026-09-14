import { create } from 'zustand';
import { DEFAULT_PARTICIPANT_SETTINGS, ParticipantSettings } from '@/features/spaces/model';

interface UserState extends ParticipantSettings {
  setState: (partial: Partial<ParticipantSettings>) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>()((set) => ({
  ...DEFAULT_PARTICIPANT_SETTINGS,
  setState: (partial) => set(partial),
  reset: () => set({ ...DEFAULT_PARTICIPANT_SETTINGS }),
}));
