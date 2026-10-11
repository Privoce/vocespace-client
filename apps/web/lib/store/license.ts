import { create } from 'zustand';
import { DEFAULT_LICENSE, License } from '@/lib/std/license';

export interface LicenseWithAnalysis extends License {
  isAnalysis: boolean;
  personLimit: number;
}

interface LicenseState {
  space: LicenseWithAnalysis;
  room: LicenseWithAnalysis | null;
  setSpace: (space: LicenseWithAnalysis) => void;
  setRoom: (room: LicenseWithAnalysis | null) => void;
}

export const useLicenseStore = create<LicenseState>()((set) => ({
  space: {
    ...DEFAULT_LICENSE,
    isAnalysis: false,
    personLimit: 5,
  },
  room: null,
  setSpace: (space) => set({ space }),
  setRoom: (room) => set({ room }),
}));
