import {
  canUseNativeChat,
  StorageUnavailableError,
  type SessionPrincipal,
} from '@vocespace/server-core';
import { getSpaceRedisClient } from './space-redis';
import { spaceRepository } from './space-repository';
import { AccessError } from '../../access';

export async function requireNativeChatMember(principal: SessionPrincipal, joinId: string) {
  const redis = getSpaceRedisClient();
  if (!redis) throw new StorageUnavailableError();
  const raw = await redis.get(`v1:native-join:${principal.id}:${joinId}`);
  let entry: { state: string; identity?: string; spaceName?: string; childRoom?: string } | null =
    null;
  if (raw) {
    try {
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      const record = value as Record<string, unknown>;
      if (record.state === 'cancelled') entry = { state: 'cancelled' };
      else {
        if (
          !['prepared', 'joined'].includes(String(record.state)) ||
          typeof record.identity !== 'string' ||
          !record.identity ||
          typeof record.spaceName !== 'string' ||
          !record.spaceName
        )
          throw new Error();
        entry = {
          state: record.state as string,
          identity: record.identity,
          spaceName: record.spaceName,
          childRoom: typeof record.childRoom === 'string' ? record.childRoom : undefined,
        };
      }
    } catch {
      throw new StorageUnavailableError();
    }
  }
  const space = entry?.spaceName ? await spaceRepository.get(entry.spaceName) : null;
  const access =
    entry?.identity && entry.spaceName
      ? {
          state: entry.state,
          identity: entry.identity,
          spaceName: entry.spaceName,
          member: !!space?.participants[entry.identity],
          revoked: !!(await redis.exists(`v1:revoked:${entry.spaceName}:${entry.identity}`)),
          mainRoomOnly:
            (space?.allowGuest === 'allow' || space?.ownerId === entry.identity) &&
            Array.isArray(space.children) &&
            (entry.childRoom
              ? space.children.some(
                  (child) =>
                    child.name === entry!.childRoom &&
                    !child.isPrivate &&
                    child.participants.includes(entry!.identity!),
                )
              : !space.children.some((child) => child.participants.includes(entry!.identity!))),
          roomName: entry.childRoom || entry.spaceName,
        }
      : null;
  if (!canUseNativeChat(principal, access, entry?.spaceName, Date.now()))
    throw new AccessError(403, 'CHAT_MEMBERSHIP_REQUIRED');
  return access;
}
