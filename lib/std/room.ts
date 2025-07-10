import { UserDefineStatus, UserStatus } from ".";
import { ModelBg, ModelRole } from "./virtual";

export interface ChildRoom {
  // room name
  name: string;
  // 参与者ID
  participants: string[];
  ownerId: string;
  // is private room
  isPrivate: boolean;
}

export interface ParticipantSettings {
  name: string;
  volume: number;
  blur: number;
  screenBlur: number;
  status: UserStatus | string;
  socketId: string;
  startAt: number;
  virtual: {
    role: ModelRole;
    bg: ModelBg;
    enabled: boolean;
  };
  openShareAudio: boolean; // 是否开启屏幕分享音频
  openPromptSound: boolean; // 是否开启新用户加入时的提示音
}

export interface RecordSettings {
  egressId?: string;
  filePath?: string;
  active: boolean;
}

export interface RoomSettings {
  participants: {
    [participantId: string]: ParticipantSettings;
  };
  status?: UserDefineStatus[];
  ownerId: string;
  record: RecordSettings;
  startAt: number;
  children: ChildRoom[]
}

export const DEFAULT_PARTICIPANT_SETTINGS: ParticipantSettings = {
  name: '',
  volume: 100,
  blur: 0.0,
  screenBlur: 0.0,
  status: UserStatus.Online,
  socketId: '',
  startAt: 0,
  virtual: {
    role: ModelRole.None,
    bg: ModelBg.ClassRoom,
    enabled: false,
  },
  openPromptSound: true,
  openShareAudio: false,
}

/**
 * key in localStorage
 */
export const PARTICIPANT_SETTINGS_KEY = "vocespace_participant_settings";