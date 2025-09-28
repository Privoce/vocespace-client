import dayjs, { Dayjs } from 'dayjs';
import { DEFAULT_USER_DEFINE_STATUS, UserDefineStatus, UserStatus } from '.';
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
}

/**
 * Participant settings in Space
 */
export interface ParticipantSettings {
  /**
   * 客户端版本
   */
  version: string;
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
  /**
   * 用户应用数据
   */
  appDatas: {
    /**
     * 待办事项应用数据
     */
    todo?: SpaceTodo;
    /**
     * 计时器应用数据
     */
    timer?: SpaceTimer;
    /**
     * 倒计时应用数据
     */
    countdown?: SpaceCountdown;
  };
  /**
   * 当前是否请求举手
   */
  raiseHand: boolean;
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
  /**
   * egress 服务ID for LiveKit
   */
  egressId?: string;
  /**
   * 录制文件存储路径
   */
  filePath?: string;
  /**
   * 录制是否开启
   */
  active: boolean;
}

/**
 * 应用Key
 * - timer: 计时器
 * - countdown: 倒计时
 * - todo: 待办事项
 */
export type AppKey = 'timer' | 'countdown' | 'todo';
export type AppAuth = 'read' | 'write';

export interface SpaceInfoMap {
  [spaceId: string]: SpaceInfo;
}

export interface SpaceInfo {
  participants: {
    [participantId: string]: ParticipantSettings;
  };
  /**
   * 用户自定义状态列表，这会保存任意在空间的参与者设置过的自定义状态
   * 主要用于在空间内的用户自定义状态选择
   */
  status?: UserDefineStatus[];
  /**
   * 空间主持人ID
   */
  ownerId: string;
  /**
   * 录制设置
   */
  record: RecordSettings;
  /**
   * 空间创建的时间戳
   */
  startAt: number;
  /**
   * 空间中子房间列表
   */
  children: ChildRoom[];
  // 应用列表，由主持人设置参与者可以使用的应用
  apps: AppKey[];
  /**
   * 空间是否为持久化空间
   * - false: 临时空间，所有数据不会持久化，空间内的应用数据也不会保存
   * - true: 持久化空间，空间内的数据会持久化，应用数据也会保存
   */
  persistence: boolean;
}

export interface TodoItem {
  id: string;
  /**
   * 任务
   */
  title: string;
  /**
   * 完成时间戳，如果未完成则没有该字段
   */
  done?: number;
  /**
   * 是否显示
   * - 当用户删除任务时，会检查done字段，如果有则表示任务已完成，设置visible为false而不是删除
   * - 如果没有done字段，则表示任务未完成，直接删除
   * - 这样做的目的是为了防止用户误操作删除了已完成的任务，导致数据丢失
   * - 用户可以通过导出功能导出已完成的任务
   */
  visible: boolean;
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
    visible: item.visible,
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
  persistence: true,
  record: { active: false },
  startAt,
  children: [],
  apps: ['todo', 'countdown'],
  status: []
});

export const DEFAULT_PARTICIPANT_SETTINGS: ParticipantSettings = {
  version: '0.3.0',
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
  openShareAudio: true,
  sync: ['todo'], // 默认同步待办事项
  auth: 'read',
  appDatas: {},
  raiseHand: false,
};

/**
 * key in localStorage
 */
export const PARTICIPANT_SETTINGS_KEY = 'vocespace_participant_settings';

export interface SettingState {
  volume: number;
  blur: number;
  screenBlur: number;
  virtual: {
    enabled: boolean;
    role: ModelRole;
    bg: ModelBg;
  };
  openShareAudio: boolean;
  openPromptSound: boolean;
}

export const getState = (uState: ParticipantSettings): SettingState => {
  return {
    volume: uState.volume,
    blur: uState.blur,
    screenBlur: uState.screenBlur,
    virtual: {
      enabled: uState.virtual.enabled,
      role: uState.virtual.role,
      bg: uState.virtual.bg,
    },
    openShareAudio: uState.openShareAudio,
    openPromptSound: uState.openPromptSound,
  };
};
