import { StorageUnavailableError, type SessionPrincipal } from '@vocespace/server-core';
import { AccessError } from '../../access';
import { requireNativeChatMember } from './native-chat';
import { getSpaceRedisClient } from './space-redis';

/** Only the confirmed sender can change their hand; this never grants media permissions. */
export async function setNativeHand(principal: SessionPrincipal, joinId: string, raised: boolean) {
  const access = await requireNativeChatMember(principal, joinId);
  const redis = getSpaceRedisClient();
  if (!redis) throw new StorageUnavailableError();
  const key = `space:${access.spaceName}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const raw = await redis.get(key);
    if (!raw) throw new AccessError(403, 'CHAT_MEMBERSHIP_REQUIRED');
    const space = JSON.parse(raw);
    if (!space.participants[access.identity])
      throw new AccessError(403, 'CHAT_MEMBERSHIP_REQUIRED');
    space.participants[access.identity].raiseHand = raised;
    // Serialize in JS to preserve empty arrays, and retry if another settings write won.
    if (
      (await redis.eval(
        `if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
       redis.call('SET',KEYS[1],ARGV[2]); return 1`,
        1,
        key,
        raw,
        JSON.stringify(space),
      )) === 1
    )
      return;
  }
  throw new StorageUnavailableError();
}
