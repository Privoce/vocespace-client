import os from 'os';
import clsx from 'clsx';
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
  creator: {
    name: string;
    id: string;
  };
  name: string;
  desc: string;
  icon: {
    key: string;
    color: string;
  };
  volume: number;
  blur: number;
  screenBlur: number;
}

// export type UserStatus = 'success' | 'processing' | 'default' | 'error' | 'warning';

export enum UserStatus {
  Online = 'online',
  Leisure = 'leisure',
  Busy = 'busy',
  Offline = 'offline',
}

export function is_web(): boolean {
  return typeof window !== 'undefined';
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