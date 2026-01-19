import os from 'os';
import clsx from 'clsx';
import { Trans } from '../i18n/i18n';
import { GetProp, UploadProps } from 'antd';
import { SpaceInfo } from './space';
import { VideoCodec } from 'livekit-client';
import { ConnectionDetails } from '../types';
/**
 * Option<T>
 *
 * Option<T> is a type that represents an optional value.
 *
 * @file lib/std/index.ts
 * @description Optional for TypeScript Type Definitions
 */
export type Option<T> = {
  [P in keyof T]?: T[P];
};

export interface Size {
  height: string;
  width: string;
}
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

export interface SizeNum {
  height: number;
  width: number;
}

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

export function is_web(): boolean {
  return typeof window !== 'undefined';
}

/**
 * 是否是iOS设备
 */
export function isIos(): boolean {
  if (!is_web()) return false;

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // iOS detection from: http://stackoverflow.com/a/9039885/177710
  return /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
}

/**
 * 是否为移动设备
 */
export function isMobile(): boolean {
  if (!is_web()) return false;

  // 检查用户代理字符串
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'mobile',
    'android',
    'iphone',
    'ipad',
    'ipod',
    'blackberry',
    'windows phone',
    'opera mini',
  ];

  const isMobileUserAgent = mobileKeywords.some((keyword) => userAgent.includes(keyword));

  // 检查触摸屏支持
  const hasTouchScreen =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0;

  // 检查屏幕尺寸 (小于768px认为是移动设备)
  const isSmallScreen = window.innerWidth < 768;

  return isMobileUserAgent || (hasTouchScreen && isSmallScreen);
}

/**
 * 是否是平板设备
 */
export function isTablet(): boolean {
  if (!is_web()) return false;

  const userAgent = navigator.userAgent.toLowerCase();
  const isTabletUserAgent =
    userAgent.includes('ipad') || (userAgent.includes('android') && !userAgent.includes('mobile'));

  const hasTouchScreen = 'ontouchstart' in window;
  const isTabletScreen = window.innerWidth >= 768 && window.innerWidth <= 1024;

  return isTabletUserAgent || (hasTouchScreen && isTabletScreen);
}

/**
 * src路径，根据部署的basePath进行调整
 * 使用在img,video等标签的src属性上
 * @param url
 * @returns
 */
export function src(url: string): string {
  let prefix = process.env.NEXT_PUBLIC_BASE_PATH;
  if (!prefix || prefix === '' || prefix === '/') {
    return url;
  }
  return `${prefix}${url}`;
}

/**
 * 连接端点路径，根据部署的basePath进行调整
 * @param url
 * @returns
 */
export function connect_endpoint(url: string): string {
  let prefix = process.env.NEXT_PUBLIC_BASE_PATH;
  if (!prefix || prefix === '' || prefix === '/') {
    return url;
  }
  return `${prefix}${url}`;
}

/**
 * 生成唯一颜色，当前仅使用在分享屏幕时用户鼠标的颜色区分上
 */
export const randomColor = (participantId: string): string => {
  // 使用参与者ID创建一个简单的哈希值
  let hash = 0;
  for (let i = 0; i < participantId.length; i++) {
    hash = participantId.charCodeAt(i) + ((hash << 5) - hash);
  }

  // 根据哈希值选择预定义的颜色
  const colors = [
    '#667085',
    '#D0D5DD',
    '#22CCEE',
    '#A4F0FC',
    '#F97066',
    '#FDA29B',
    '#FDB022',
    '#FFC84B',
    '#32D583',
    '#A6F4C4',
    '#717BBC',
    '#B3B8DB',
    '#5FE9D0',
    '#36BFFB',
    '#528AFF',
    '#865BF7',
    '#EE45BC',
    '#FF682F',
    '#FDEAD7',
  ];

  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export const getServerIp = () => {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    const networkInterface = interfaces[interfaceName];
    if (networkInterface) {
      for (const net of networkInterface) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  }
  return null;
};

export function isProp<U extends HTMLElement, T extends React.HTMLAttributes<U>>(
  prop: T | undefined,
): prop is T {
  return prop !== undefined;
}

interface Props {
  [key: string]: any;
}
type TupleTypes<T> = { [P in keyof T]: T[P] } extends { [key: number]: infer V } ? V : never;
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

export function mergePropsReactAria<T extends Props[]>(
  ...args: T
): UnionToIntersection<TupleTypes<T>> {
  // Start with a base clone of the first argument. This is a lot faster than starting
  // with an empty object and adding properties as we go.
  const result: Props = { ...args[0] };
  for (let i = 1; i < args.length; i++) {
    const props = args[i];
    for (const key in props) {
      const a = result[key];
      const b = props[key];

      // Chain events
      if (
        typeof a === 'function' &&
        typeof b === 'function' &&
        // This is a lot faster than a regex.
        key[0] === 'o' &&
        key[1] === 'n' &&
        key.charCodeAt(2) >= /* 'A' */ 65 &&
        key.charCodeAt(2) <= /* 'Z' */ 90
      ) {
        result[key] = chain(a, b);

        // Merge classnames, sometimes classNames are empty string which eval to false, so we just need to do a type check
      } else if (
        (key === 'className' || key === 'UNSAFE_className') &&
        typeof a === 'string' &&
        typeof b === 'string'
      ) {
        result[key] = clsx(a, b);
      } else {
        result[key] = b !== undefined ? b : a;
      }
    }
  }

  return result as UnionToIntersection<TupleTypes<T>>;
}

export function chain(...callbacks: any[]): (...args: any[]) => void {
  return (...args: any[]) => {
    for (const callback of callbacks) {
      if (typeof callback === 'function') {
        try {
          callback(...args);
        } catch (e) {
          console.error(e);
        }
      }
    }
  };
}

export function mergeProps<
  U extends HTMLElement,
  T extends Array<React.HTMLAttributes<U> | undefined>,
>(...props: T) {
  return mergePropsReactAria(...props.filter(isProp));
}

export const isUndefinedString = (value: string | undefined): boolean => {
  return value === undefined || value.trim() === '';
};

export const isUndefinedNumber = (value: number | undefined): boolean => {
  return value === undefined || isNaN(value);
};

export type FileType = Parameters<GetProp<UploadProps, 'beforeUpload'>>[0];

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
 * 通过url下载文件
 * @param url
 */
export const downloadFile = (url: string, fileName: string) => {
  const element = document.createElement('a');
  element.href = url;
  element.download = fileName;
  document.body.appendChild(element);
  element.click();
};

/**
 * AuthType 用户认证类型
 * vocespace: 来自vocespace.com平台登录
 * space: 来自space.voce.chat平台登录
 * c_s: 来自客服系统登录 (目前专为sohive设计)考虑到泛用性，命名为customer_service，可后续扩展
 * other: 来自其他未知平台登录
 */
export type AuthType = 'vocespace' | 'space' | 'c_s' | 'other' | string;

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
 * - other: 其他身份
 * - owner: 空间所有者
 * - manager: 空间管理员
 * - participant: 空间参与者
 * - guest: 访客
 *
 * 目前对assistant和customer的已确定进行特殊处理，后续可根据需要扩展
 */
export type IdentityType =
  | 'assistant'
  | 'customer'
  | 'other'
  | 'owner'
  | 'manager'
  | 'participant'
  | 'guest';

/**
 * TokenResult 用户Token解析结果，当前仅用于sohive接入，后续可扩展
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
