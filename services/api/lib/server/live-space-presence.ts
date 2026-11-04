import { RoomServiceClient } from 'livekit-server-sdk';
import { getConfig } from './config';

/** Redis stores room preferences/history; only LiveKit can confirm a running meeting. */
export function liveSpaceClient() {
  const { livekit } = getConfig();
  return new RoomServiceClient(livekit.url.replace(/^ws/, 'http'), livekit.key, livekit.secret);
}

export async function liveSpaceMembers(space: string, client = liveSpaceClient()) {
  try {
    const participants = await client.listParticipants(space);
    return new Set(
      participants.filter((participant) => !participant.permission?.hidden)
        .map((participant) => participant.identity),
    );
  } catch (error) {
    // A room can disappear between ListRooms and ListParticipants. Other failures are not emptiness.
    if (error instanceof Error && 'code' in error && error.code === 'not_found') return new Set<string>();
    throw error;
  }
}
