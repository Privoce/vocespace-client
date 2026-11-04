import { platformFetch } from '../api/client';
import { platformConfiguration } from '../runtime-config';
import { v4 as uuidv4 } from 'uuid';
import { UserInfo } from './user';
import { currentTimestamp, todayTimestamp } from '.';
export type Extraction = 'easy' | 'medium' | 'max';

export interface AICutParticipantConf {
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
 * 用户的基础设置，去除了不必要的信息
 */
export interface ParticipantSettings {
  // /**
  //  * 客户端版本
  //  */
  // version: string;
  // /**
  //  * 参与者名称
  //  */
  // name: string;
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
  // /**
  //  * 用户状态：系统状态/用户自定义状态
  //  */
  // status: UserStatus | string;
  // socketId: string;
  // /**
  //  * 参与者开始时间
  //  */
  // startAt: number;
  // /**
  //  * 虚拟形象
  //  */
  // virtual: {
  //   role: ModelRole;
  //   bg: ModelBg;
  //   enabled: boolean;
  // };
  /**
   * 是否开启屏幕分享音频
   */
  openShareAudio: boolean;
  /**
   * 是否开启新用户加入时的提示音
   */
  openPromptSound: boolean;
  // /**
  //  * 用户应用同步
  //  */
  // sync: AppKey[];
  // /**
  //  * 用户应用权限
  //  */
  // auth: AppAuth;
  // /**
  //  * 用户应用数据
  //  */
  // appDatas: {
  //   /**
  //    * 待办事项应用数据
  //    */
  //   todo?: SpaceTodo[];
  //   /**
  //    * 计时器应用数据
  //    */
  //   timer?: SpaceTimer;
  //   /**
  //    * 倒计时应用数据
  //    */
  //   countdown?: SpaceCountdown;
  // };
  // /**
  //  * 当前是否请求举手
  //  */
  // raiseHand: boolean;
  /**
   * ai相关的功能设置
   */
  ai: {
    /**
     * AI截图分析功能
     */
    cut: AICutParticipantConf;
  };
  // /**
  //  * 是否在线，如果用户在线则新用户如果重名无法加入，如果不在线则允许重名加入
  //  */
  // online: boolean;
  // /**
  //  * 是否认证通过
  //  */
  // isAuth: boolean;
}

export enum FrequencyInterval {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
  Yearly = 'yearly',
  Flexible = 'flexible',
}

export interface Frequency {
  interval: FrequencyInterval;
  // For 'flexible' interval, specify days of week (0=Sunday,...6=Saturday)
  in_week?: number[];
}

export enum SpaceState {
  Active = 'active',
  Waiting = 'waiting',
}

export enum SpaceType {
  Meeting = 'meeting',
  Class = 'class',
  Hobbies = 'hobbies',
  Tech = 'tech',
}

export interface Space {
  id?: string;
  name: string;
  desc?: string;
  created_at: string;
  expired_at: string;
  /**
   * Start time as UNIX timestamp
   */
  start_at?: string;
  end_at?: string;
  /**
   * Frequency of the space (e.g., daily, weekly, monthly)
   */
  freq: Frequency;
  /**
   * 费用，订阅费用
   */
  fee: number;
  owner_id: string;
  state?: SpaceState;
  /**
   * 订阅人数
   */
  sub_count: number;
  online_count?: number;
  /**
   * space url, link to join or view the space
   */
  url: string;
  /**
   * Array of image URLs
   */
  images: string[];
  ty: SpaceType | string;
  /**
   * Detailed description or content of the space (e.g., markdown format)
   */
  readme?: string;
  public: boolean;
}

export interface SpaceJsonB {
  id?: string;
  name: string;
  desc?: string;
  created_at: string;
  expired_at: string;
  /**
   * Start time as UNIX timestamp
   */
  start_at?: string;
  end_at?: string;
  freq: string;
  fee: number;
  owner_id: string;
  state?: SpaceState;
  sub_count: number;
  online_count?: number;
  url: string;
  images: string;
  readme?: string;
  public: boolean;
  ty: SpaceType | string;
}

export const castToSpace = (spaceJsonB: SpaceJsonB): Space => {
  const decode = (value: unknown, fallback: unknown) => {
    if (typeof value !== 'string') return value ?? fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  const freq = decode(spaceJsonB.freq, { interval: FrequencyInterval.Flexible });
  const images = decode(spaceJsonB.images, []);
  return {
    ...spaceJsonB,
    freq:
      freq && typeof freq === 'object' && 'interval' in freq
        ? freq
        : { interval: FrequencyInterval.Flexible },
    images: Array.isArray(images)
      ? images.filter((image): image is string => typeof image === 'string')
      : [],
  };
};

/**
 * Initialize a new space with default values
 * @param partial Partial space object
 * @returns Initialized space object or null if required fields are missing
 * - needed fields: name, url, owner_id
 */
export const initSpace = (partial: Partial<Space>): Space | null => {
  const now = Date.now();
  const nowString = new Date(now).toLocaleString();
  const default_expired_at = new Date(now + 365 * 24 * 3600 * 1000).toLocaleString();
  if (!partial.name || !partial.url || !partial.owner_id) {
    return null;
  } else {
    return {
      name: partial.name,
      desc: partial.desc || '',
      url: partial.url,
      owner_id: partial.owner_id,
      created_at: partial.created_at || nowString,
      expired_at: partial.expired_at || default_expired_at, // default 1 year later
      freq: partial.freq || { interval: FrequencyInterval.Flexible },
      fee: partial.fee || 0,
      sub_count: partial.sub_count || 0,
      images: partial.images || [],
      ty: partial.ty || SpaceType.Meeting,
      public: partial.public !== undefined ? partial.public : false,
    };
  }
};

/**
 * 可以是具体的房间名
 * 1. $empty: 任意空房间
 * 2. string: 其他自定义房间名, 具体房间，用户将直接进入该房间，如果没有则创建该房间
 * 3. $space: 空间主房间，无需后续进行任何处理，用户将直接进入空间主房间
 */
export type RoomType = '$empty' | string | '$space';

/**
 * IdentityType 用户身份类型
 * - assistant: 客服人员
 * - customer: 顾客
 * - other: 其他身份
 * - owner: 空间所有者
 * - manager: 空间管理员
 * - participant: 空间参与者
 * - guest: 访客
 */
export type IdentityType =
  | 'assistant'
  | 'customer'
  | 'other'
  | 'owner'
  | 'manager'
  | 'participant'
  | 'guest';

export interface TokenResult {
  /**
   * 用户ID
   */
  id: string;
  /**
   * 用户名
   */
  username: string;
  /**
   * 头像
   */
  avatar?: string;
  /**
   * 空间名
   */
  space: string;
  /**
   * 房间名
   */
  room?: RoomType;
  /**
   * 身份类型，目前只有两种
   * IdentityType 用户身份类型
   * - assistant: 客服人员
   * - customer: 顾客
   * - other: 其他身份
   * - owner: 空间所有者
   * - manager: 空间管理员
   * - participant: 空间参与者
   * - guest: 访客
   */
  identity: IdentityType;
  /**
   * 是否经过预加入页面进入，如果为true则需要经过预加入页面，false则直接进入
   */
  preJoin?: boolean;
  /**
   * 签发时间
   */
  iat?: number;
  /**
   * 过期时间
   */
  exp?: number;
}

export const vocespaceUrl = async (
  info: UserInfo,
  _authFrom: 'vocespace' | 'space' = 'vocespace',
  spaceName?: string,
  _redirectTo?: string,
): Promise<string> => {
  const response = await platformFetch('entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spaceName: spaceName || info.username }),
  });
  if (!response.ok) throw new Error('Unable to enter meeting');
  return (await response.json()).redirectUrl;
};

export const vocespaceUrlVisit = (spaceName: string) => {
  return `${platformConfiguration().meetingUrl}/${encodeURIComponent(spaceName)}`;
};

export const vocespaceName = (username: string, spaceName?: string) => {
  return spaceName || username;
};

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

export type AppKey = 'timer' | 'countdown' | 'todo';

export interface SpaceAIConf {
  cut: {
    enabled: boolean;
    freq: number; // 截图频率，单位分钟
  };
}

export interface ParticipantWorkConf {
  /**
   * 是否开启工作模式, 在space中表示空间是否开启工作模式（目前没有作用）
   */
  enabled: boolean;
  /**
   * 视频模糊度, 在这里是存储用户原先的模糊度设置
   */
  videoBlur: number;
  /**
   * 屏幕分享模糊度，在这里是存储用户原先的模糊度设置
   */
  screenBlur: number;
}

export interface SpaceWorkConf extends ParticipantWorkConf {
  /**
   * 是否开启AI分析，开启后每个开始工作模式的用户都会自动启动AI分析
   * 当然，用户可以选择开启后手动关闭AI分析
   */
  useAI: boolean;
  /**
   * 同步的配置项
   * - 视频模糊度
   * - 屏幕分享模糊度
   */
  sync: boolean;
}

/**
 * vocespace.com 等在客户端真实的空间结构，在后端中我们需要清洗成Space结构以便存储和处理
 */
export interface VoceSpaceInfo {
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
   * 空间管理员ID列表，空间管理员可获得owner同等权限但无法对owner进行管理
   * owner可以将其他用户设置为管理员，每个空间最多5个管理员，管理员可以转让自己的身份
   * 管理员只能管理空间用户，无法删除空间，但可以更改部分空间设置
   *
   * 管理员可以管理用户的权限和应用：
   *  - 帮助修改用户的名称
   *  - 关闭/开启用户的麦克风和摄像头
   *  - 开放空间应用给其他用户使用
   *  - 录制空间
   *  - 删除用户子房间
   *  - 设置用户声音/虚化
   *  - 强制用户离开空间
   *
   *  ---
   *
   * 管理员无法进行以下操作：
   *  - 删除空间
   *  - 转让空间所有权
   *  - 修改空间的持久化设置
   *  - 修改空间的访客加入设置
   *  - 修改空间的AI相关设置
   *  - 更改空间证书
   */
  managers: string[];
  /**
   * 是否允许访客加入
   * 若为false，则只有认证用户才能加入空间
   */
  allowGuest: boolean;
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
  /**
   * 空间的AI相关配置
   */
  ai: SpaceAIConf;
  /**
   * 工作模式相关配置
   *
   */
  work: SpaceWorkConf;
}

export interface VoceSpaceInfoMapObj {
  [spaceName: string]: VoceSpaceInfo;
}

export type VoceSpaceInfoMap = Map<string, VoceSpaceInfo>;

/**
 * 转换并清理MapObj为Space结构
 * 将对象转换为 Map 结构， 由于 TS 不支持直接将对象转换为 Map，所以需要手动转换
 * **平台端传过来的都是Obj结构的，转为Map更容易后续处理**
 * @param obj
 */
export const convertObjToSpace = (obj: VoceSpaceInfoMapObj): Space[] => {
  const spaces: Space[] = [];
  for (const [spaceName, info] of Object.entries(obj)) {
    const space: Space = {
      id: uuidv4(),
      name: spaceName,
      desc: '',
      //2025-11-17T22:31:43+00:00
      created_at: new Date(info.startAt).toISOString(),
      expired_at: new Date(info.startAt + 365 * 24 * 3600 * 1000).toISOString(), // default 1 year later
      freq: { interval: FrequencyInterval.Flexible },
      fee: 0,
      owner_id: info.ownerId,
      sub_count: Object.keys(info.participants).length,
      url: vocespaceUrlVisit(spaceName),
      images: [],
      ty: SpaceType.Meeting,
      public: !info.allowGuest,
    };
    spaces.push(space);
  }
  return spaces;
};

/**
 * ## 合并或覆盖空间信息
 * 合并或覆盖空间信息，这个方法用于清理空间信息，由于我们会从vocespace.com获取空间信息还会从数据库中获取空间信息
 * - remote: 来自 vocespace.com 的空间信息
 * - local: 来自我们数据库的空间信息
 * 这两个空间信息可能是会有重复的，我们需要合并或覆盖这些信息以便后续使用
 * ### 覆盖规则
 * 只要发现remote和local的url是一致的，直接用local覆盖remote，否则不覆盖，不用name判断的原因是name可能会重复，但url是唯一的
 * @param remote
 * @param local
 */
export const mergeOrCoverSpaces = (remote: Space[], local: Space[]): Space[] => {
  const allSpaces: Space[] = [];
  const localMap: Map<string, Space> = new Map();
  // 先将local空间信息存入Map，key为url，value为Space对象
  for (const space of local) {
    localMap.set(space.url, space);
  }
  // 遍历remote空间信息，判断是否有对应的local空间信息
  for (const rSpace of remote) {
    if (localMap.has(rSpace.url)) {
      // 如果有对应的local空间信息，则用local覆盖remote
      allSpaces.push(localMap.get(rSpace.url)!);
      // 删除已经处理过的local空间信息
      localMap.delete(rSpace.url);
    } else {
      // 如果没有对应的local空间信息，则直接使用remote空间信息
      allSpaces.push(rSpace);
    }
  }
  // 最后将剩余的local空间信息添加到allSpaces中
  for (const lSpace of localMap.values()) {
    allSpaces.push(lSpace);
  }
  return allSpaces;
};

export const sortSpacesByUserNum = (spaces: Space[]): Space[] => {
  return spaces.sort((a, b) => (b.sub_count || 0) - (a.sub_count || 0));
};
