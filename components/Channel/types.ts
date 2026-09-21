'use client';

import {
  UserStatus
} from '@/lib/std';
import { ReadableConf } from '@/lib/std/conf';
import { ChildRoom, ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { MessageInstance } from 'antd/es/message/interface';
import { Room } from 'livekit-client';
export interface ChannelProps {
  // roomName: string;
  space: Room;
  messageApi: MessageInstance;
  localParticipantId: string;
  onUpdate: () => Promise<void>;
  tracks: TrackReferenceOrPlaceholder[];
  settings: SpaceInfo;
  isActive?: boolean;
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
  toRenameSettings?: (isDefineStatus?: boolean) => void;
  toSettings?: () => void;
  setUserStatus: (status: UserStatus | string) => Promise<void>;
  showFlotApp: () => void;
  config: ReadableConf;
}

export interface ChannelExports {
  join: (room: ChildRoom, participantId: string) => Promise<void>;
  joinMain: () => Promise<void>;
}

export type RoomPrivacy = 'public' | 'private';

export type FeedbackType = 'bug' | 'error' | 'question' | 'suggestion' | 'other';

export interface FeedbackUploadItem {
  uid: string;
  name: string;
  status: 'uploading' | 'done' | 'error';
  url?: string;
}
