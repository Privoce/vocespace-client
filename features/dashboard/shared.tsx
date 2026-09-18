'use client';

import { Typography } from 'antd';
export const { Title } = Typography;

export interface LeaderboardData {
  key: string;
  participantName: string;
  spaceId: string;
  totalDuration: number;
  periodDuration: number;
  totalDisplay: string;
  periodDisplay: string;
}

export interface HistorySpaceData {
  key: string;
  room: string;
  during: string;
  today: string;
}

export interface ParticipantTableData {
  key: string;
  spaceId: string;
  participantId: string;
  name: string;
  volume: number;
  blur: number;
  screenBlur: number;
  status: boolean;
  isOwner: boolean;
  isRecording: boolean;
  virtualEnabled: boolean;
  during: string;
  online: boolean;
  isAuth: boolean;
}

export type ActionKey =
  | 'refresh'
  | 'global_conf'
  | 'manage_spaces'
  | 'ac_space'
  | 'smtp_conf'
  | 'hyperbeam_conf'
  | 'flushdb';

export type MenuTab = 'drive' | 'home' | 'license' | 'licenseManage' | 'recording' | 'log' | 'history';
