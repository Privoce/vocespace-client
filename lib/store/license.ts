import { create } from 'zustand';
import { DEFAULT_LICENSE, License } from '@/lib/std/license';

export interface LicenseWithAnalysis extends License {
  isAnalysis: boolean;
  personLimit: number;
}

interface LicenseState {
  space: LicenseWithAnalysis;
  /* DOCKER: room: LicenseWithAnalysis | null; */
  setSpace: (space: LicenseWithAnalysis) => void;
  /* DOCKER: setRoom: (room: LicenseWithAnalysis | null) => void; */
}

export const useLicenseStore = create<LicenseState>()((set) => ({
  space: {
    ...DEFAULT_LICENSE,
    isAnalysis: false,
    personLimit: 5,
  },
  /* DOCKER: room: null, */
  setSpace: (space) => set({ space }),
  /* DOCKER: setRoom: (room) => set({ room }), */
}));
