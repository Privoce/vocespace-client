import { Trans } from '@/lib/i18n/i18n';
import { SpaceInfo } from '@/features/spaces/model';
import { VideoCodec } from 'livekit-client';
import { ConnectionDetails } from '@/lib/livekit/connection';
export enum UserStatus {
  Online = 'settings.general.status.online',
  Leisure = 'settings.general.status.leisure',
  Busy = 'settings.general.status.busy',
  Offline = 'settings.general.status.offline',
  Working = 'settings.general.status.working',
}


export const TransIfSystemStatus = (t: Trans, state: string): string => {
  switch (state) {
    case UserStatus.Online:
      return `🟢 ${t('settings.general.status.online')}`;
    case UserStatus.Offline:
      return t('settings.general.status.offline');
    case UserStatus.Busy:
      return t('settings.general.status.busy');
    case UserStatus.Leisure:
      return t('settings.general.status.leisure');
    default:
      return state || '';
  }
};


export interface UserItemProp {
  name: string;
  status: UserStatus;
}


export interface UserDefineStatus {
  id: string;
  /**
   * 创建者
   */
  creator: {
    name: string;
    id: string;
  };
  /**
   * 状态名称
   */
  title: string;
  volume: number;
  blur: number;
  screenBlur: number;
}


export enum CreateSpaceError {
  ParamLack = 'common.create_space.error.param',
  SpaceExist = 'common.create_space.error.exist',
}


export enum EnterRoomError {
  // 房间已满员，请稍后再试
  FullAndWait = 'api.room.error.full_and_wait',
  NotExist = 'api.room.error.not_exist',
  InvalidIdentityCS = 'api.room.error.invalid_identity_c_s',
}


export const ERROR_CODE = {
  createSpace: CreateSpaceError,
  enterRoom: EnterRoomError,
};


/**
 * SpaceParticipantType 空间参与者身份类型
 * 管理员和Owner的isManager都是true
 */
export interface SpaceParticipantType {
  /**
   * 是否是管理员或Owner
   */
  isManager: boolean;
  /**
   * 具体身份
   */
  ty: 'Manager' | 'Owner' | 'Participant';
}


export const isSpaceManager = (spaceInfo: SpaceInfo, pid: string): SpaceParticipantType => {
  if (pid === spaceInfo.ownerId) {
    return {
      isManager: true,
      ty: 'Owner',
    };
  } else if (spaceInfo.managers.includes(pid)) {
    return {
      isManager: true,
      ty: 'Manager',
    };
  } else {
    return {
      isManager: false,
      ty: 'Participant',
    };
  }
};


/**
 * AuthType 用户认证类型
 * vocespace: 来自vocespace.com平台登录
 * space: 来自space.voce.chat平台登录
 * c_s: 来自客服系统登录 (目前专为sohive设计)考虑到泛用性，命名为customer_service，可后续扩展
 * other: 来自其他未知平台登录
 */
export type AuthType = 'vocespace' | 'space' | 'c_s' | 'other' | string;


export interface ChildRoomEnter {
  space: string;
  room: string;
  roomOwner: string;
  /**
   * 平台用户信息, 该用户可能曾经登陆过该空间
   */
  platUser?: PlatformUser;
}


export const encodeChildRoomEnter = (space: string, room: string, roomOwner: string): string => {
  return encodeURIComponent(
    JSON.stringify({
      space,
      room,
      roomOwner,
    } as ChildRoomEnter),
  );
};


/**
 * VoceSpace SearchParams 搜索参数类型
 *
 */
export interface SearchParams {
  /**
   * 地区
   */
  region?: string;
  /**
   * 是否高清
   */
  hq?: string | boolean;
  /**
   * 编码格式
   */
  codec?: VideoCodec;
  // 这里目的是为了标识返回的url，不是为了区分登录方式，从vocespace.com就是vocespace，从space.voce.chat就是space，暂时没有特殊意义
  // 即使没有这个参数也不会影响功能
  auth?: AuthType;
  /**
   * 携带的data，如果为string，则需要解析成TokenResult类型
   * 由 /api/connection-details 返回
   */
  data?: string | TokenResult;
  /**
   * 由 /api/connection-details 返回的连接详情字符串化结果
   */
  details?: string | ConnectionDetails;
  /**
   * 外部化子房间名称，用户邀请他人时使用
   */
  room?: RoomType;
  /**
   * 用户通过内部用户生成的邀请链接进入指定space的某个子房间时使用
   */
  childRoomEnter?: ChildRoomEnter | string;
}


/**
 * 可以是具体的房间名
 * 1. $empty: 任意空房间
 * 2. string: 其他自定义房间名, 具体房间，用户将直接进入该房间，如果没有则创建该房间
 * 3. $space: 空间主房间，无需后续进行任何处理，用户将直接进入空间主房间
 * 需要注意的是只要带有room参数，用户每次进入都会进入指定房间，没有必要请勿使用该参数
 */
export type RoomType = '$empty' | string | '$space';


/**
 * IdentityType 用户身份类型
 * - assistant: 客服人员
 * - customer: 顾客
 * - owner: 空间所有者
 * - manager: 空间管理员
 * - participant: 空间参与者
 * - guest: 访客
 *
 * 处理
 * - assistant: auth = c_s 时 客服人员的身份，拥有侧边栏房间管理无AI功能
 * - customer: auth = c_s 时 顾客的身份，只有加入房间功能无侧边栏和AI功能
 * - owner = space owner, 拥有所有权限
 * - manager = space manager, 拥有大部分权限
 * - participant = space participant, 普通参与者权限
 * - guest = space guest, 访客权限，受限较多
 *
 * 没有auth时默认为guest身份
 * participant属于通过平台接入的普通用户，没有特殊权限
 * guest属于未通过平台接入的访客，权限受限较多
 * manager相当于被owner授予权限的participant，guest身份无法被授予权限
 * 因此manager，owner，participant三种身份必须通过平台接入
 *
 * guest虽然可以通过客户端创建一个空间，变成空间的owner但是依然无法用侧边栏和AI功能，只能使用基础的音视频功能
 */
export type IdentityType = 'assistant' | 'customer' | 'owner' | 'manager' | 'participant' | 'guest';


/**
 * TokenResult 用户Token解析结果
 */
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
   * **需要注意的是只要带有room参数，用户每次进入都会进入指定房间，没有必要请勿使用该参数**
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
  identity?: IdentityType;
  /**
   * 是否经过预加入页面进入，如果为true则需要经过预加入页面，false则直接进入
   */
  preJoin?: boolean;
  /**
   * 签发时间
   */
  iat: number;
  /**
   * 过期时间
   */
  exp: number;
}


/**
 * PlatformUser 来自平台的用户信息
 */
export interface PlatformUser extends TokenResult {
  auth: AuthType;
}


/**
 * 拆解PlatformUser为TokenResult和AuthType
 * @param platUser
 */
export const splitPlatformUser = (
  platUser: PlatformUser,
): {
  tokenResult: TokenResult;
  auth: AuthType;
} => {
  return {
    auth: platUser.auth,
    tokenResult: {
      id: platUser.id,
      username: platUser.username,
      avatar: platUser.avatar,
      space: platUser.space,
      room: platUser.room,
      identity: platUser.identity,
      preJoin: platUser.preJoin,
      iat: platUser.iat,
      exp: platUser.exp,
    },
  };
};


/**
 * 生成默认的TokenResult对象, 为guest
 */
export const DEFAULT_TOKEN_RESULT = (
  space: string,
  username: string,
  room?: string,
): TokenResult => {
  return {
    id: generateBasicIdentity(username, space),
    username,
    space,
    identity: 'guest',
    room,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 15,
  };
};


/**
 * 校验TokenResult是否合法，不可省略必要字段
 * @param tokenResult
 * @returns
 */
export const verifyTokenResult = (tokenResult: Partial<TokenResult>): boolean => {
  return !(!tokenResult.id || !tokenResult.username || !tokenResult.space);
};


export const generateBasicIdentity = (participantName: string, spaceName: string): string =>
  `${participantName}__${spaceName}`;


export const verifyPlatformUser = (platUser: PlatformUser | TokenResult): boolean => {
  // 只需要验证exp是否过期
  const currentTime = Math.floor(Date.now() / 1000);
  if (platUser.exp && platUser.exp < currentTime) {
    return false;
  }
  return true;
};
