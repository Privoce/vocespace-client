'use client';

import { useMeeting } from '@/features/home/hooks/use-meeting';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { useI18n } from '@/lib/i18n/i18n';
import { useEffect, useState } from 'react';

export function useNewSpace() {
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
export type NewSpaceModel = ReturnType<typeof useNewSpace>;
