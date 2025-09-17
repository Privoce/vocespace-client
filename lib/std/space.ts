import dayjs, { Dayjs } from 'dayjs';
import { UserDefineStatus, UserStatus } from '.';
import { ModelBg, ModelRole } from './virtual';
import { PresetStatusColorType } from 'antd/es/_util/colors';
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
  title: string;
  done?: number;
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
};

export type LicenseLimit = 'free' | 'pro' | 'enterprise';

/**
 * License information
 */
export interface License {
  /**
   * License ID
   */
  id?: string;
  /**
   * user email (buyer email)
   */
  email?: string;
  /**
   * server domain
   */
  domains?: string;
  /**
   * license creation timestamp
   */
  created_at: number;
  /**
   * license expiration timestamp
   */
  expires_at: number;
  /**
   * license token value
   */
  value: string;
  /**
   * license limit
   */
  ilimit: LicenseLimit;
  /**
   * is a temporary license or not
   */
  isTmp?: boolean;
}

export const getLicensePersonLimit = (licenseLimit: LicenseLimit, isTmp?: boolean): number => {
  if (isTmp) return 20;
  switch (licenseLimit) {
    case 'free':
      return 5;
    case 'pro':
      return 9999;
    case 'enterprise':
      return 9999;
    default:
      return 5;
  }
};

export enum LicenseStatus {
  /**
   * license is expired
   */
  Expired,
  /**
   * license is valid
   */
  Valid,
  /**
   * tmp valid
   */
  Tmp,
}

export const licenseStatus = (license: License): LicenseStatus => {
  const now = Date.now();
  if (license.isTmp) {
    return LicenseStatus.Tmp;
  } else {
    if (now > license.expires_at * 1000) {
      return LicenseStatus.Expired;
    }
    return LicenseStatus.Valid;
  }
};

export const licenseStatusStr = (status: LicenseStatus): string => {
  switch (status) {
    case LicenseStatus.Expired:
      return 'Expired';
    case LicenseStatus.Valid:
      return 'Valid';
    case LicenseStatus.Tmp:
      return 'Temporary';
    default:
      return 'Expired';
  }
};

export const licenseStatusColor = (status: LicenseStatus): PresetStatusColorType => {
  switch (status) {
    case LicenseStatus.Expired:
      return 'error';
    case LicenseStatus.Valid:
      return 'success';
    case LicenseStatus.Tmp:
      return 'warning';
    default:
      return 'error';
  }
};



/**
 * key in localStorage
 */
export const PARTICIPANT_SETTINGS_KEY = 'vocespace_participant_settings';
