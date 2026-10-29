import { basePath as configuredBasePath } from '@/lib/runtime-config';
import {
  Option,
  Size,
  UserStatus,
  SizeNum,
  UserItemProp,
  UserDefineStatus,
  isUndefinedString,
  isUndefinedNumber,
  CreateSpaceError,
  EnterRoomError,
  ERROR_CODE,
  SpaceParticipantType,
  isSpaceManager,
  AuthType,
  ChildRoomEnter,
  encodeChildRoomEnter,
  SearchParams,
  RoomType,
  IdentityType,
  TokenResult,
  PlatformUser,
  splitPlatformUser,
  DEFAULT_TOKEN_RESULT,
  verifyTokenResult,
  verifyPlatformUser,
  httpServerOrIp,
} from '@vocespace/domain';
export * from '@vocespace/domain';
import clsx from 'clsx';
import { Trans } from '../i18n/i18n';
import { GetProp, UploadProps } from 'antd';
import { SpaceInfo } from './space';
import { VideoCodec } from 'livekit-client';
import { ConnectionDetails } from '../types';
import { ChatMsgItem } from './chat';
import { api } from '../api';

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

export function is_web(): boolean {
  return typeof window !== 'undefined';
}

export function isWeChatBrowser(): boolean {
  if (!is_web()) return false;

  return navigator.userAgent.includes('MicroMessenger');
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

export function isWeChatMobile(): boolean {
  return isWeChatBrowser() && isMobile();
}

export function supportsMediaDeviceChangeEvent(): boolean {
  if (!is_web() || !navigator.mediaDevices) return false;
  if (isWeChatMobile()) return false;

  return (
    typeof navigator.mediaDevices.addEventListener === 'function' &&
    typeof navigator.mediaDevices.removeEventListener === 'function'
  );
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
  const prefix =
    configuredBasePath;
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
  const prefix =
    configuredBasePath;
  if (!prefix || prefix === '' || prefix === '/') {
    return url;
  }
  return `${prefix}${url}`;
}

/**
 * 生成唯一颜色，当前仅使用在分享屏幕时用户鼠标的颜色区分上
 */
export { participantColor as randomColor } from '@vocespace/meeting-core';

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

export type FileType = Parameters<GetProp<UploadProps, 'beforeUpload'>>[0];

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

// 处理大文件上传（通过 HTTP API）
export const handleLargeFileUpload = async (
  file: FileType,
  params: {
    spaceName: string;
    participantIdentity: string;
    participantName: string;
  },
  abortController?: AbortController,
): Promise<ChatMsgItem> => {
  try {
    const response = await api.uploadFile(
      file,
      params.spaceName,
      { identity: params.participantIdentity, name: params.participantName },
      abortController,
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Large file upload success:', result);

    // 创建文件消息，使用服务器返回的 URL
    let timestamp = Date.now();
    const fileMessage: ChatMsgItem = {
      id: timestamp.toString(),
      sender: {
        id: params.participantIdentity,
        name: params.participantName || params.participantIdentity,
      },
      message: `file: ${file.name}`,
      type: 'file',
      roomName: params.spaceName,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        url: result.fileUrl, // 使用文件服务 API
      },
      timestamp,
    };
    return fileMessage;
  } catch (error) {
    console.error('Large file upload failed:', error);
    throw error;
  }
};

// 处理小文件上传（通过 Socket）
export const handleSmallFileUpload = async (
  file: FileType,
  params: {
    spaceName: string;
    participantIdentity: string;
    participantName: string;
  },
): Promise<ChatMsgItem> => {
  return new Promise<ChatMsgItem>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = e.target?.result;
      console.log('Small file upload:', file.size, file.name, file.type);

      const fileMessage: ChatMsgItem = {
        sender: {
          id: params.participantIdentity,
          name: params.participantName || params.participantIdentity,
        },
        message: null,
        type: 'file',
        roomName: params.spaceName,
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
          data: fileData,
        },
        timestamp: Date.now(),
      };

      // 发送文件消息
      // socket.emit('chat_file', fileMessage);
      resolve(fileMessage);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
};
