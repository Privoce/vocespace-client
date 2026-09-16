import { useMemo } from 'react';
import { ConnectionState, type Room } from 'livekit-client';
import type { SpaceInfo } from '@/features/spaces/model';

export interface SelfRoom {
  name: string;
  participants: string[];
  ownerId: string;
  isPrivate: boolean;
}

export function useSelfRoom(space: Room | undefined, settings: SpaceInfo): SelfRoom | undefined {
  return useMemo(() => {
    if (!space || space.state !== ConnectionState.Connected || !settings || !settings.children) {
      return undefined;
    }

    let selfRoom = settings.children.find((child) => {
      return child.participants.includes(space.localParticipant.identity);
    });

    const allChildParticipants = settings.children.reduce((acc, room) => {
      return acc.concat(room.participants);
    }, [] as string[]);

    if (!selfRoom) {
      selfRoom = {
        name: space.name,
        participants: Object.keys(settings.participants).filter((pid) => {
          return !allChildParticipants.includes(pid);
        }),
        ownerId: settings.ownerId,
        isPrivate: false,
      };
    }

    return selfRoom;
  }, [settings, space]);
}
