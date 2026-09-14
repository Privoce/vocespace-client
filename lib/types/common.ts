
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
