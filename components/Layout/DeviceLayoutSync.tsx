'use client';

import { useEffect } from 'react';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { useSpaceStore } from '@/lib/store/space';

/** Compatibility bridge for room views that will be split in stage 2. */
export function DeviceLayoutSync() {
  const device = useLayoutDevice();
  useEffect(() => {
    useSpaceStore.getState().setDeviceType(device === 'phone' ? 'mobile' : 'desktop');
  }, [device]);
  return null;
}
