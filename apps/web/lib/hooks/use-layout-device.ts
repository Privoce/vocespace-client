'use client';

import { useSyncExternalStore } from 'react';
import { getLayoutDevice, subscribeLayoutDevice, type LayoutDevice } from '@/lib/layout-device';

const serverSnapshot = (): LayoutDevice => 'pc';

export function useLayoutDevice() {
  return useSyncExternalStore(subscribeLayoutDevice, getLayoutDevice, serverSnapshot);
}
