import dayjs, { Dayjs } from 'dayjs';
import { UserStatus } from '.';
import { ModelBg, ModelRole } from './virtual';
import { Extraction } from '../ai/analysis';

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

export interface AICutParticipantConf {
  enabled: boolean;
  /**
   * 是否需要在任务栏显示分析时间以及需要进行时间统计
   */
  spent: boolean;
  /**
   * 是否要结合待办事项进行分析
   */
  todo: boolean;
  /**
   * 提取内容配置的精细度
   */
  extraction: Extraction;
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
    todo?: SpaceTodo[];
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
  /**
   * ai相关的功能设置
   */
  ai: {
    /**
     * AI截图分析功能
     */
    cut: AICutParticipantConf;
  };
  /**
   * 是否在线，如果用户在线则新用户如果重名无法加入，如果不在线则允许重名加入
   */
  online: boolean;
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
  // /**
  //  * 用户自定义状态列表，这会保存任意在空间的参与者设置过的自定义状态
  //  * 主要用于在空间内的用户自定义状态选择
  //  */ @deprecated 由用户内部维护
  // status?: UserDefineStatus[];
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
  ai: {
    cut: {
      freq: number; // 截图频率，单位分钟
    };
  };
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
  date: number;
}

export const sortTodos = (todos: SpaceTodo[]): SpaceTodo[] => {
  if (todos.length === 0) return [];

  // 创建深拷贝以避免修改只读对象
  const sortedTodos = todos.map((todo) => {
    // 对items进行排序：未完成的排在前面，相同完成状态按id（时间戳）排序
    const sortedItems = [...todo.items].sort((a, b) => {
      if ((!a.done && !b.done) || (a.done && b.done)) {
        // 都未完成或都已完成，按id排序（新的在前面）
        return Number(b.id) - Number(a.id);
      }
      if (a.done && !b.done) {
        // a已完成，b未完成，b排前面
        return 1;
      }
      if (!a.done && b.done) {
        // a未完成，b已完成，a排前面
        return -1;
      }

      return 0;
    });

    return {
      ...todo,
      items: sortedItems,
    };
  });

  // 按照date进行排序，最新的在前面
  return sortedTodos.sort((a, b) => b.date - a.date);
};

export const todayTimeStamp = (timestamp?: number): number => {
  const date = timestamp ? dayjs(timestamp) : dayjs();
  return date.startOf('day').valueOf();
};

export const DEFAULT_TODOS: SpaceTodo = {
  items: [],
  date: todayTimeStamp(),
};

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
  children: [
    {
      name: 'Meeting Room',
      participants: [],
      ownerId: 'system',
      isPrivate: false,
    },
    {
      name: '☕️ Coffee Break',
      participants: [],
      ownerId: 'system',
      isPrivate: false,
    },
  ],
  apps: ['todo', 'countdown'],
  ai: {
    cut: {
      freq: 5,
    },
  },
});

export const DEFAULT_PARTICIPANT_SETTINGS: ParticipantSettings = {
  version: '0.4.6',
  name: '',
  volume: 100,
  blur: 0.0,
  screenBlur: 0.0,
  status: 'settings.general.status.online',
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
  ai: {
    cut: {
      enabled: true,
      spent: false,
      todo: true,
      extraction: 'medium',
    },
  },
  online: true,
};

/**
 * key in localStorage
 */
export const PARTICIPANT_SETTINGS_KEY = 'vocespace_participant_settings';
/**
 * 来自 Vocespace 平台的用户ID 标识，用于标识用户是否为匿名用户
 */
export const VOCESPACE_PLATFORM_USER_ID = 'vocespace_platform_user_id';

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
