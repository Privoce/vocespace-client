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
import { useRoomStore } from '@/lib/store';
import {
  AppstoreOutlined
} from '@ant-design/icons';
import { useLocalParticipant } from '@livekit/components-react';
import { Button } from 'antd';
import { MessageInstance } from 'antd/es/message/interface';
export interface FlotButtonProps {
  style?: React.CSSProperties;
  openApp: boolean;
  setOpenApp: (open: boolean) => void;
}

export function FlotButton({ style, openApp, setOpenApp }: FlotButtonProps) {
  const { localParticipant } = useLocalParticipant();
  const targetParticipant = useRoomStore((s) => s.remoteApp);

  return (
    <Button
      onClick={async () => {
        if (!openApp && targetParticipant.participantId !== localParticipant.identity) {
          useRoomStore.getState().setRemoteApp({
            participantId: localParticipant.identity,
            participantName: localParticipant.name,
            auth: 'write',
          });
        }
        setOpenApp(!openApp);
      }}
      type="text"
      style={{
        height: 'fit-content',
        width: 'fit-content',
        padding: '6px 2px',
        backgroundColor: '#00000050',
        borderRadius: '24px',
        color: '#fff',
        ...style
      }}
      icon={<AppstoreOutlined style={{ fontSize: 16 }} />}
    ></Button>
  );
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
