import { withMediaMember } from './media-lock';
import { RoomServiceClient } from 'livekit-server-sdk';
import { getConfig } from './config';
import { getSpaceRedisClient } from './space-redis';
import { SpaceManager } from './legacy-space-manager';

/** Revoke at the media server as well as in business state; UI notification alone is insufficient. */
export async function removeMediaMember(space: string, identity: string) {
  return withMediaMember(space, identity, async () => {
    const media = getConfig().livekit;
    const client = new RoomServiceClient(media.url.replace(/^ws/, 'http'), media.key, media.secret);
    const connected = await client.listParticipants(space);
    if (connected.some((participant) => participant.identity === identity))
      await client.removeParticipant(space, identity);
    await getSpaceRedisClient()?.set(`v1:revoked:${space}:${identity}`, '1', 'EX', 7 * 24 * 3600);
    await SpaceManager.removeParticipant(space, identity);
  });
}
