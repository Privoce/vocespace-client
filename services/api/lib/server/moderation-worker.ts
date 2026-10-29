import { RoomServiceClient } from 'livekit-server-sdk';
import { getConfig } from './config';
import { spaceRepository } from './space-repository';
import { withMediaMember } from './media-lock';
import { getSpaceRedisClient } from './space-redis';
import { memberSessionKey } from './moderation';

/** Retry media failures and evict previously issued tokens that reconnect after a ban. */
export async function reconcileSpaceBans() {
  let client: RoomServiceClient | undefined;
  for (const [name, space] of Object.entries(await spaceRepository.list())) {
    if (!space.blacklist?.length) continue;
    try {
      if (!client) {
        const media = getConfig().livekit;
        client = new RoomServiceClient(media.url.replace(/^ws/, 'http'), media.key, media.secret);
      }
      const mediaClient = client;
      for (const peer of await mediaClient.listParticipants(name)) {
        const sessionId = await getSpaceRedisClient()?.get(memberSessionKey(name, peer.identity));
        if (!space.blacklist.includes(peer.identity) &&
          (!sessionId || !space.blacklist.includes(sessionId))) continue;
        await withMediaMember(name, peer.identity, async () => {
          await mediaClient.removeParticipant(name, peer.identity);
        });
      }
    } catch {
      // One unavailable room must not prevent other bans or preview maintenance from running.
      console.error('Space ban media cleanup failed; will retry');
    }
  }
}
