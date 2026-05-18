'use client';

import { useEffect } from 'react';
import { clearUnloadAttempt, markUnloadAttempt } from '@/lib/roomLeaveIntent';

export default function BeforeUnloadGuard({ enabled = true }: { enabled?: boolean }) {
  useEffect(() => {
    if (!enabled) {
      clearUnloadAttempt();
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      markUnloadAttempt();
      event.preventDefault();
      event.returnValue = '';
    };

    const handleStayOnPage = () => {
      if (document.visibilityState === 'visible') {
        clearUnloadAttempt();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('focus', handleStayOnPage);
    window.addEventListener('pageshow', handleStayOnPage);
    document.addEventListener('visibilitychange', handleStayOnPage);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('focus', handleStayOnPage);
      window.removeEventListener('pageshow', handleStayOnPage);
      document.removeEventListener('visibilitychange', handleStayOnPage);
      clearUnloadAttempt();
    };
  }, [enabled]);

  return null;
}