'use client';


import { UserStatus } from '@/lib/std';
import { ReadableConf } from '@/lib/std/conf';
import { AICutParticipantConf, ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { Track } from 'livekit-client';
import * as React from 'react';
import { TabKey } from '../Settings';

export type ControlBarControls = {
  microphone?: boolean;
  camera?: boolean;
  chat?: boolean;
  screenShare?: boolean;
  leave?: boolean;
  settings?: boolean;
};

export interface ControlBarProps extends React.HTMLAttributes<HTMLDivElement> {
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
  variation?: 'minimal' | 'verbose' | 'textOnly';
  controls?: ControlBarControls;
  /**
   * If `true`, the user's device choices will be persisted.
   * This will enable the user to have the same device choices when they rejoin the space.
   * @defaultValue true
   * @alpha
   */
  saveUserChoices?: boolean;
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
  setUserStatus: (status: UserStatus | string) => Promise<void>;
  spaceInfo: SpaceInfo;
  fetchSettings: () => Promise<void>;
  updateRecord: (active: boolean, egressId?: string, filePath?: string) => Promise<boolean>;
  setPermissionDevice: (device: Track.Source) => void;
  openApp: boolean;
  setOpenApp: (open: boolean) => void;
  toRenameSettings: () => void;
  startOrStopAICutAnalysis: (
    freq: number,
    conf: AICutParticipantConf,
    reload?: boolean,
  ) => Promise<void>;
  openAIServiceAskNote: () => void;
  downloadAIMdReport?: () => Promise<void>;
  config: ReadableConf;
}

export interface ControlBarExport {
  openSettings: (key: TabKey, isDefineStatus?: boolean) => void;
  showAICutAnalysisSettings: (open: boolean) => void;
  isChatOpen: boolean;
  setChatOpen: (open: boolean) => void;
}
