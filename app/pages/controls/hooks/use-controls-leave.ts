import { useCallback } from 'react';
import { markExplicitLeaveIntent } from '@/features/room/leave-intent';

export function useControlsLeave() {
  const onLeave = useCallback(() => {
    markExplicitLeaveIntent();
  }, []);

  return {
    onLeave,
  };
}
