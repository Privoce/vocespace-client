'use client';

import { useSyncExternalStore } from 'react';
import { getLayoutDevice, subscribeLayoutDevice, type LayoutDevice } from '../layout-device';

const serverSnapshot = (): LayoutDevice => 'pc';

export function useLayoutDevice() {
  return useSyncExternalStore(subscribeLayoutDevice, getLayoutDevice, serverSnapshot);
}
