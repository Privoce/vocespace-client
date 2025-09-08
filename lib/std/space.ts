import dayjs, { Dayjs } from 'dayjs';
import { UserDefineStatus, UserStatus } from '.';
import { ModelBg, ModelRole } from './virtual';

/**
 * Child room information
 */
export interface ChildRoom {
  /**
   * room name
   */
  name: string;
  /**
   * 参与者ID
   * participantId
   */
  participants: string[];
  /**
   * room owner ID
   */
  ownerId: string;
  /**
   * is private room or not
   */
  isPrivate: boolean;
  /**
   * 队伍所有队员的ID，当isPrivate为true时有效
   * 当isPrivate为true时，表示该房间是一个私人房间，只有teamIds中的队员可以直接加入该房间
   * 无需房间所有者的同意
   */
  teamIds: string[];
}

/**
 * Participant settings in Space
 */
export interface ParticipantSettings {
  /**
   * 参与者名称
   */
  name: string;
  /**
   * 音量
   */
  volume: number;
  /**
   * 视频模糊度
   */
  blur: number;
  /**
   * 屏幕分享模糊度
   */
  screenBlur: number;
  /**
   * 用户状态：系统状态/用户自定义状态
   */
  status: UserStatus | string;
  socketId: string;
  /**
   * 参与者开始时间
   */
  startAt: number;
  /**
   * 虚拟形象
   */
  virtual: {
    role: ModelRole;
    bg: ModelBg;
    enabled: boolean;
  };
  /**
   * 是否开启屏幕分享音频
   */
  openShareAudio: boolean;
  /**
   * 是否开启新用户加入时的提示音
   */
  openPromptSound: boolean;
  /**
   * 用户应用同步
   */
  sync: AppKey[];
  /**
   * 用户应用权限
   */
  auth: AppAuth;
  appDatas: {
    todo?: SpaceTodo;
    timer?: SpaceTimer;
    countdown?: SpaceCountdown;
  };
  teamId?: number;
}

export interface SpaceTimeRecord {
  start: number; // 记录开始时间戳
  end?: number; // 记录结束时间戳
}

export interface SpaceDateRecord {
  /**
   * 空间的使用记录
   */
  space: SpaceTimeRecord[];
  /**
   * 参与者的使用记录
   */
  participants: {
    [name: string]: SpaceTimeRecord[];
  };
}

/**
 * 记录空间的使用情况
 * 主要应用在空间的使用记录中
 */
export interface SpaceDateRecords {
  [spaceId: string]: SpaceDateRecord;
}

export interface RecordSettings {
  egressId?: string;
  filePath?: string;
  active: boolean;
}

export type AppKey = 'timer' | 'countdown' | 'todo';
export type AppAuth = 'read' | 'write';

export interface SpaceInfoMap {
  [spaceId: string]: SpaceInfo;
}

export interface SpaceInfo {
  participants: {
    [participantId: string]: ParticipantSettings;
  };
  status?: UserDefineStatus[];
  ownerId: string;
  record: RecordSettings;
  startAt: number;
  children: ChildRoom[];
  // 应用列表，由主持人设置参与者可以使用的应用
  apps: AppKey[];
  persistence: boolean;
}

export interface TodoItem {
  id: string;
  title: string;
  done: boolean;
}

export interface Timer {
  value: number | null;
  running: boolean;
  stopTimeStamp: number | null;
  records: string[];
}

/**
 * 倒计时App的数据结构
 */
export interface Countdown {
  value: number | null;
  duration: Dayjs | null;
  running: boolean;
  stopTimeStamp: number | null;
}

export interface CountdownDurStr {
  value: number | null;
  duration: string | null;
  running: boolean;
  stopTimeStamp: number | null;
}

export interface SpaceTodo {
  items: TodoItem[];
  /**
   * 上传时间戳，表示用户上传到空间的时间
   */
  timestamp: number;
}

export interface SpaceTimer extends Timer {
  timestamp: number;
}

export interface SpaceCountdown extends CountdownDurStr {
  timestamp: number;
}

export const castTimer = (timer?: SpaceTimer): Timer | undefined => {
  if (!timer) return undefined;
  return {
    value: timer.value,
    running: timer.running,
    stopTimeStamp: timer.stopTimeStamp,
    records: timer.records,
  };
};

export const castCountdown = (countdown?: SpaceCountdown): Countdown | undefined => {
  if (!countdown) return undefined;
  return {
    value: countdown.value,
    duration: dayjs(countdown.duration) as Dayjs | null,
    running: countdown.running,
    stopTimeStamp: countdown.stopTimeStamp,
  };
};

export const castTodo = (todo?: SpaceTodo): TodoItem[] | undefined => {
  if (!todo) return undefined;
  return todo.items.map((item) => ({
    id: item.id,
    title: item.title,
    done: item.done,
  }));
};

export const DEFAULT_TIMER: Timer = {
  value: null as number | null,
  running: false,
  stopTimeStamp: null as number | null,
  records: [] as string[],
};

export const DEFAULT_COUNTDOWN: Countdown = {
  value: null as number | null,
  duration: dayjs().hour(0).minute(5).second(0) as Dayjs | null,
  running: false,
  stopTimeStamp: null as number | null,
};

export const DEFAULT_SPACE_INFO = (startAt: number): SpaceInfo => ({
  participants: {},
  ownerId: '',
  persistence: false,
  record: { active: false },
  startAt,
  children: [],
  apps: ['todo', 'countdown'],
});

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
  sync: [],
  auth: 'read',
  appDatas: {},
};

/**
 * key in localStorage
 */
export const PARTICIPANT_SETTINGS_KEY = 'vocespace_participant_settings';
