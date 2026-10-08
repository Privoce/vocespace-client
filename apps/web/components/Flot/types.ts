'use client';

import { AICutAnalysisRes } from '@/lib/ai/analysis';
import { AICutService } from '@/lib/ai/cut';
import {
  AICutParticipantConf,
  AppAuth,
  AppKey,
  Countdown,
  ParticipantSettings,
  RecordSettings,
  SpaceInfo,
  SpaceTodo,
  Timer
} from '@/lib/std/space';
import { MessageInstance } from 'antd/es/message/interface';
export interface FlotButtonProps {
  style?: React.CSSProperties;
  openApp: boolean;
  setOpenApp: (open: boolean) => void;
}

export interface FlotLayoutProps {
  messageApi: MessageInstance;
  openApp: boolean;
  setOpenApp: (open: boolean) => void;
  spaceInfo: SpaceInfo;
  space: string;
  showAICutAnalysisSettings?: (open: boolean) => void;
  aiCutAnalysisRes?: AICutAnalysisRes;
  reloadResult?: () => Promise<void>;
  startOrStopAICutAnalysis?: (
    freq: number,
    conf: AICutParticipantConf,
    reload?: boolean,
  ) => Promise<void>;
  openAIServiceAskNote?: () => void;
  cutInstance: AICutService;
  updateSettings: (
    newSettings: Partial<ParticipantSettings>,
    record?: RecordSettings,
    init?: boolean,
  ) => Promise<boolean | undefined>;
  showAI: boolean;
}

export interface FlotLayoutExports {
  downloadAIMdReport?: () => Promise<void>;
}

export interface FlotAppItemProps {
  messageApi: MessageInstance;
  apps: AppKey[];
  space: string;
  spaceInfo: SpaceInfo;
  onHeightChange?: (height: number) => void;
  isSelf: boolean;
  participantId: string;
}

export interface TimerProp {
  data: Timer;
  setData: (data: Timer) => Promise<void>;
  auth: AppAuth;
}

export interface CountdownProp {
  data: Countdown;
  setData: (data: Countdown) => Promise<void>;
  auth: AppAuth;
}

export interface TodoProp {
  data: SpaceTodo[];
  setData: (data: SpaceTodo) => Promise<void>;
  auth: AppAuth;
}

export const DEFAULT_KEYS: (AppKey | 'together')[] = ['timer', 'countdown', 'todo', 'together'];

export interface FlotAppExports {
  clientHeight?: number;
}
