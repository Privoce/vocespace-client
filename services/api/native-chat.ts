import { createHash } from 'node:crypto';
import {
  CONFERENCE_CHAT_LIMIT,
  parseConferenceMessage,
  parseJoinId,
  type ConferenceMessage,
} from '@vocespace/contracts';
import { StorageUnavailableError } from '@vocespace/server-core';
import { getSpaceRedisClient } from './lib/server/space-redis';
import { requireNativeChatMember } from './lib/server/native-chat';
import { requireNative } from './native-auth';
import { ApiRequest, ApiResponse } from './http';

export async function nativeChatEndpoint(request: ApiRequest) {
  const { principal } = await requireNative(request);
  if (request.method !== 'POST') return new ApiResponse(null, { status: 405 });
  const joinId = parseJoinId(await request.json());
  const access = await requireNativeChatMember(principal, joinId);
  const redis = getSpaceRedisClient();
  if (!redis) throw new StorageUnavailableError();
  const raw = await redis.get(`chat:${access.spaceName}`);
  let stored: unknown;
  try {
    stored = raw ? JSON.parse(raw) : [];
  } catch {
    throw new StorageUnavailableError();
  }
  if (!Array.isArray(stored)) throw new StorageUnavailableError();
  const items: ConferenceMessage[] = [];
  for (const value of stored.slice(-CONFERENCE_CHAT_LIMIT)) {
    try {
      const item = parseConferenceMessage({
        ...value,
        // Pre-migration Web messages did not always have IDs; retain a stable display key.
        id:
          value.id || `legacy_${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`,
      });
      if (item.roomName === access.roomName) items.push(item);
    } catch {
      /* Skip malformed legacy entries, without forwarding arbitrary fields. */
    }
  }
  // Recheck after loading history: exit/revocation may have happened during the read.
  const current = await requireNative(request);
  await requireNativeChatMember(current.principal, joinId);
  return ApiResponse.json({ items });
}
