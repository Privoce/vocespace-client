'use client';

import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { useI18n } from '@/lib/i18n/i18n';
import { useEffect,useState } from 'react';
import { useMeeting } from './use-meeting';

export function useHomePage() {
  const { t } = useI18n();
  const device = useLayoutDevice();
  const [loading, setLoading] = useState(true);
  const [hq, setHq] = useState(false);
  const meeting = useMeeting({ hq, setHq });
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);
  return { t, device, loading, meeting };
}
export type HomePageModel = ReturnType<typeof useHomePage>;
