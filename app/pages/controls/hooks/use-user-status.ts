import { useCallback } from 'react';
import type { Room } from 'livekit-client';
import { UserDefineStatus, UserStatus } from '@/lib/std';
import { useRoomStore, useUserStore } from '@/lib/store';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsBase } from '@/lib/std/device';

/**
 * 用户状态管理 hook
 */
export function useUserStatus(space: Room | null | undefined, updateSettings: (settings: Record<string, any>) => Promise<boolean | undefined>) {
  const uState = useUserStore();
  const uRoomStatusState = useRoomStore((s) => s.roomStatusList);

  const setUserStatus = useCallback(async (status: UserStatus | string) => {
    let newStatus: Record<string, any> = { status };
    switch (status) {
      case UserStatus.Online:
        if (space) {
          space.localParticipant.setMicrophoneEnabled(true);
          space.localParticipant.setCameraEnabled(true);
          space.localParticipant.setScreenShareEnabled(false);
          if (uState.volume === 0) {
            newStatus.volume = 80;
          }
        }
        break;
      case UserStatus.Leisure:
        newStatus.blur = 0.15;
        newStatus.screenBlur = 0.15;
        break;
      case UserStatus.Busy:
        newStatus.blur = 0.15;
        newStatus.screenBlur = 0.15;
        newStatus.volume = 0;
        break;
      case UserStatus.Offline:
        if (space) {
          space.localParticipant.setMicrophoneEnabled(false);
          space.localParticipant.setCameraEnabled(false);
          space.localParticipant.setScreenShareEnabled(false);
        }
        break;
      default: {
        if (space) {
          const statusSettings = uRoomStatusState.find((item) => item.id === status);
          if (statusSettings) {
            Object.assign(newStatus, {
              volume: statusSettings.volume,
              blur: statusSettings.blur,
              screenBlur: statusSettings.screenBlur,
            });
          }
        }
        break;
      }
    }
    await updateSettings(newStatus);
    if (space) {
      socket.emit('update_user_status', { space: space.name } as WsBase);
    }
  }, [space, uState, uRoomStatusState, updateSettings]);

  return { setUserStatus };
}
