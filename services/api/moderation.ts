import { randomUUID } from 'node:crypto';
import type { SpaceInfo } from '@vocespace/domain/space';
import { StorageUnavailableError, planSpaceBan, ModerationDenied } from '@vocespace/server-core';
import { parseJoinId } from '@vocespace/contracts';
import { ApiRequest, ApiResponse } from './http';
import { AccessError, membership, safeSegment } from './access';
import { requireNative } from './native-auth';
import { requireNativeChatMember } from './lib/server/native-chat';
import { sessions, sessionToken } from './lib/server/sessions';
import { getSpaceRedisClient } from './lib/server/space-redis';
import { isSpaceBlocked, memberSessionKey } from './lib/server/moderation';
import { removeMediaMember } from './lib/server/media-members';

/** Both adapters resolve the actor from a verified session, never a submitted role or UID. */
export async function moderationEndpoint(request: ApiRequest, native: boolean) {
  if (request.method !== 'POST') throw new AccessError(405, 'METHOD_NOT_ALLOWED');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new AccessError(415, 'JSON_REQUIRED');
  const principal = native ? (await requireNative(request)).principal
    : await sessions.read(sessionToken(request.headers));
  if (!principal || (!native && principal.client === 'native')) throw new AccessError(401, 'SESSION_REQUIRED');
  if (!native && (request.headers.get('x-vocespace-request') !== '1' ||
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin)))
    throw new AccessError(403, 'ORIGIN_DENIED');
  const body = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    !safeSegment(body.targetId) || body.confirm !== true) throw new AccessError(400, 'INVALID_MODERATION');
  const spaceName = native ? (await requireNativeChatMember(principal, parseJoinId(body))).spaceName : body.spaceName;
  if (!safeSegment(spaceName)) throw new AccessError(400, 'INVALID_SPACE');
  const actor = (await membership(principal, spaceName)).id;
  const redis = getSpaceRedisClient();
  if (!redis) throw new StorageUnavailableError();
  // Backfill verified socket bindings for members connected before this API update.
  for (const socket of globalThis.vocespaceSocketServer?.sockets.sockets.values() || []) {
    const peer = await sessions.read(socket.data.token);
    const id = peer?.identities[spaceName];
    if (peer && id) await redis.set(memberSessionKey(spaceName, id), peer.id, 'EX',
      Math.max(1, Math.ceil((peer.expiresAt - Date.now()) / 1000)));
  }
  let saved = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const raw = await redis.get(`space:${spaceName}`);
    if (!raw) throw new AccessError(404, 'SPACE_NOT_FOUND');
    const space: SpaceInfo = JSON.parse(raw);
    if (isSpaceBlocked(space, principal, actor)) throw new AccessError(403, 'SPACE_BLACKLISTED');
    const target = body.targetId as string;
    const ids = [...new Set([...Object.keys(space.participants), target])];
    const bindings = await redis.mget(...ids.map((id) => memberSessionKey(spaceName, id)));
    let plan;
    try {
      plan = planSpaceBan(space, actor, target, Object.fromEntries(ids.map((id, i) => [id, bindings[i] || undefined])));
    } catch (error) {
      if (error instanceof ModerationDenied) throw new AccessError(error.status, error.code);
      throw error;
    }
    const { targets } = plan;
    space.blacklist = plan.blacklist;
    for (const id of targets) delete space.participants[id];
    space.managers = space.managers.filter((id) => !space.blacklist.includes(id));
    for (const child of space.children) child.participants = child.participants.filter((id) => !space.blacklist.includes(id));
    const result = await redis.eval(`
      if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
      redis.call('SET',KEYS[1],ARGV[2]); redis.call('SET',KEYS[2],ARGV[3]); return 1`,
      2, `space:${spaceName}`, `v1:preview:epoch:${spaceName}`, raw, JSON.stringify(space), randomUUID());
    if (result !== 1) continue;
    saved = true;
    for (const socket of globalThis.vocespaceSocketServer?.sockets.sockets.values() || []) {
      const peer = await sessions.read(socket.data.token);
      if (peer && isSpaceBlocked(space, peer, peer.identities[spaceName])) {
        socket.emit('remove_participant_response', { space: spaceName });
        socket.leave(`space:${spaceName}`);
      }
    }
    globalThis.vocespaceSocketServer?.to(`space:${spaceName}`).emit('user_status_updated', { space: spaceName });
    // A failed media removal remains banned; worker reconciliation retries it.
    for (const id of new Set([target, ...targets])) await removeMediaMember(spaceName, id);
    break;
  }
  if (!saved) throw new StorageUnavailableError();
  return ApiResponse.json({ success: true });
}
