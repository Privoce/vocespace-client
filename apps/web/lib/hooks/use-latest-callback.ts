'use client';
import { useCallback, useRef } from 'react';

/** Stable subscription callbacks read the current controller without restarting timers. */
export function useLatestCallback<T extends (...args: any[]) => any>(callback: T): T {
  const latest = useRef(callback);
  latest.current = callback;
  return useCallback((...args: Parameters<T>) => latest.current(...args), []) as T;
}
