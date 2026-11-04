/** Read-only dashboard data. No room configuration, credentials or media URLs. */
export interface DashboardParticipant {
  name: string;
  volume: number;
  blur: number;
  screenBlur: number;
  online: boolean;
  isOwner: boolean;
  isAuth: boolean;
  isGuest: boolean;
  virtualEnabled: boolean;
}

export interface DashboardSnapshot {
  spaces: Record<string, {
    isRecording: boolean;
    participants: Record<string, DashboardParticipant>;
  }>;
  records: Record<string, {
    space: { start: number; end?: number }[];
    participants: Record<string, { start: number; end?: number }[]>;
  }>;
}
