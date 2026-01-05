import os from 'os';
import clsx from 'clsx';
import { Trans } from '../i18n/i18n';
import { GetProp, UploadProps } from 'antd';
import { SpaceInfo, VOCESPACE_PLATFORM_USER_ID } from './space';
import { PUserInfo } from '../hooks/platform';
import dayjs from 'dayjs';
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

export const DEFAULT_USER_DEFINE_STATUS: UserDefineStatus[] = [
  {
    id: UserStatus.Working,
    creator: {
      name: 'system',
      id: 'system',
    },
    title: 'settings.general.status.working',
    volume: 100,
    blur: 0,
    screenBlur: 0,
  },
];

export function is_web(): boolean {
  return typeof window !== 'undefined';
}

export function isIos(): boolean {
  if (!is_web()) return false;

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // iOS detection from: http://stackoverflow.com/a/9039885/177710
  return /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
}

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

export function isTablet(): boolean {
  if (!is_web()) return false;

  const userAgent = navigator.userAgent.toLowerCase();
  const isTabletUserAgent =
    userAgent.includes('ipad') || (userAgent.includes('android') && !userAgent.includes('mobile'));

  const hasTouchScreen = 'ontouchstart' in window;
  const isTabletScreen = window.innerWidth >= 768 && window.innerWidth <= 1024;

  return isTabletUserAgent || (hasTouchScreen && isTabletScreen);
}

export function src(url: string): string {
  let prefix = process.env.NEXT_PUBLIC_BASE_PATH;
  if (!prefix || prefix === '' || prefix === '/') {
    return url;
  }
  return `${prefix}${url}`;
}

export function connect_endpoint(url: string): string {
  let prefix = process.env.NEXT_PUBLIC_BASE_PATH;
  if (!prefix || prefix === '' || prefix === '/') {
    return url;
  }
  return `${prefix}${url}`;
}
///生成唯一颜色
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

export const ERROR_CODE = {
  createSpace: CreateSpaceError,
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
