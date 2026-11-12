'use client';
import { useSyncExternalStore } from 'react';
import { PHONE_MEDIA_QUERY } from '@vocespace/meeting-core';
const subscribe = (changed: () => void) => {
  const query = window.matchMedia(PHONE_MEDIA_QUERY);
  query.addEventListener('change', changed);
  return () => query.removeEventListener('change', changed);
};
export function useLayoutDevice() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PHONE_MEDIA_QUERY).matches, () => false);
}
