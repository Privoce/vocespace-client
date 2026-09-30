'use client';

import { ParticipantSettings, SettingState, SpaceInfo } from '@/lib/std/space';
import { MessageInstance } from 'antd/es/message/interface';
import { LocalParticipant, Room } from 'livekit-client';
export interface SettingsProps {
  username: string;
  close: boolean;
  tab: {
    key: TabKey;
    setKey: (e: TabKey) => void;
  };
  messageApi: MessageInstance;
  space: Room;
  localParticipant: LocalParticipant;
  spaceInfo: SpaceInfo;
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
  showAI: boolean;
}

export interface SettingsExports {
  username: string;
  removeVideo: () => void;
  startVideo: () => Promise<void>;
  setAppendStatus: (append: boolean) => void;
  state: SettingState;
}

export type TabKey =
  | 'auth'
  | 'general'
  | 'profile'
  | 'audio'
  | 'video'
  | 'screen'
  | 'about_us'
  | 'app'
  | 'recording'
  | 'license'
  | 'ai';
