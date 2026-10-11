import { nativeOwnerKey } from './native-create';
import { withMediaMember } from './lib/server/media-lock';
import { randomBytes } from 'node:crypto';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { parseJoinId, parseNativeJoinRequest } from '@vocespace/contracts';
import { StorageUnavailableError } from '@vocespace/server-core';
import { getConfig } from './lib/server/config';
import { getSpaceRedisClient } from './lib/server/space-redis';
import { spaceRepository } from './lib/server/space-repository';
import { sessions } from './lib/server/sessions';
import { DEFAULT_PARTICIPANT_SETTINGS, type SpaceInfo } from '@vocespace/domain/space';
import { requireNative } from './native-auth';
import { AccessError } from './access';
import { ApiRequest, ApiResponse } from './http';

type Entry = {
  state: 'prepared' | 'joined' | 'cancelled';
  spaceName: string;
  nickname: string;
  childRoom?: string;
  identity: string;
  ownerIdentity?: string;
  joinId: string;
  expiresAt: number;
};

/** Manual guest conference only. Discovery, capacity reservations and previews are separate work. */
export async function nativeConferenceEndpoint(request: ApiRequest) {
  const { token, principal } = await requireNative(request);
  if (!['POST', 'PUT', 'DELETE'].includes(request.method))
    return new ApiResponse(null, { status: 405 });
  const body = await request.json();
  const joinId = parseJoinId(body);
  const redis = getSpaceRedisClient();
  if (!redis) throw new StorageUnavailableError();
  const key = `v1:native-join:${principal.id}:${joinId}`;
  if (request.method === 'POST') {
    const input = parseNativeJoinRequest(body);
    const space = await spaceRepository.get(input.spaceName);
    if (!space) throw new AccessError(404, 'SPACE_NOT_FOUND');
    const ownerIdentity = await redis.get(nativeOwnerKey(principal.id, input.spaceName));
    const isOwner = !!ownerIdentity && space.ownerId === ownerIdentity;
    if (!isOwner && space.allowGuest !== 'allow') throw new AccessError(403, 'GUEST_DENIED');
    if (!Array.isArray(space.children)) throw new StorageUnavailableError();
    if (input.childRoom) {
      const child = space.children.find((room) => room.name === input.childRoom);
      if (!child) throw new AccessError(404, 'ROOM_NOT_FOUND');
      if (child.isPrivate) throw new AccessError(403, 'PRIVATE_ROOM');
    }
    const candidate: Entry = {
      ...input,
      identity: `native_${randomBytes(12).toString('hex')}`,
      ...(isOwner ? { ownerIdentity: ownerIdentity! } : {}),
      state: 'prepared',
      expiresAt: Date.now() + 60_000,
    };
    await redis.set(key, JSON.stringify(candidate), 'EX', 600, 'NX');
    const entry: Entry = JSON.parse((await redis.get(key))!);
    if (entry.state === 'cancelled') throw new AccessError(409, 'JOIN_CANCELLED');
    if (
      entry.spaceName !== input.spaceName ||
      entry.nickname !== input.nickname ||
      entry.childRoom !== input.childRoom
    )
      throw new AccessError(409, 'JOIN_CONFLICT');
    if (entry.expiresAt <= Date.now()) throw new AccessError(410, 'JOIN_EXPIRED');
    principal.identities[entry.spaceName] = entry.identity;
    await sessions.save(token, principal);
    const media = getConfig().livekit;
    const rtc = new AccessToken(media.key, media.secret, {
      identity: entry.identity,
      name: entry.nickname,
      metadata: JSON.stringify({ sessionId: principal.id, nativeJoinId: joinId }),
      ttl: Math.max(1, Math.floor((entry.expiresAt - Date.now()) / 1000)),
    });
    rtc.addGrant({
      room: entry.spaceName,
      roomJoin: true,
      canPublish: false,
      canPublishData: false,
      canSubscribe: true,
      canUpdateOwnMetadata: false,
    });
    return ApiResponse.json({
      joinId,
      identity: entry.identity,
      serverUrl: media.url,
      roomName: entry.spaceName,
      participantName: entry.nickname,
      childRoom: entry.childRoom,
      participantToken: await rtc.toJwt(),
    });
  }
  let entry: Entry | null = JSON.parse((await redis.get(key)) || 'null');
  if (request.method === 'DELETE') {
    // Cancellation can arrive before prepare. Keep a tombstone to reject a delayed request.
    const result = (await redis.eval(
      `local raw=redis.call('GET',KEYS[1]);
      local e=raw and cjson.decode(raw) or {}; e.state='cancelled'
      redis.call('SET',KEYS[1],cjson.encode(e),'EX',600); return raw`,
      1,
      key,
    )) as string | null;
    entry = result ? JSON.parse(result) : null;
    if (!entry?.identity) return ApiResponse.json({ success: true });
    const media = getConfig().livekit;
    const client = new RoomServiceClient(media.url.replace(/^ws/, 'http'), media.key, media.secret);
    const leaving = entry;
    await withMediaMember(leaving.spaceName, leaving.identity, async () => {
      const participants = await client.listParticipants(leaving.spaceName);
      if (participants.some((p) => p.identity === leaving.identity))
        await client.removeParticipant(leaving.spaceName, leaving.identity);
    });
    // Compare-and-set preserves JSON empty arrays (Redis cjson would encode [] as {}).
    let removed = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const raw = await redis.get(`space:${entry.spaceName}`);
      if (!raw) {
        removed = true;
        break;
      }
      const space: SpaceInfo = JSON.parse(raw);
      delete space.participants[entry.identity];
      for (const child of space.children)
        child.participants = child.participants.filter((id) => id !== entry!.identity);
      const result = await redis.eval(
        `if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
        redis.call('SET',KEYS[1],ARGV[2]); return 1`,
        1,
        `space:${entry.spaceName}`,
        raw,
        JSON.stringify(space),
      );
      if (result === 1) {
        removed = true;
        break;
      }
    }
    if (!removed) throw new StorageUnavailableError();
    for (const socket of globalThis.vocespaceSocketServer?.sockets.sockets.values() || []) {
      if (socket.data.sessionId === principal.id) socket.leave(`space:${entry.spaceName}`);
    }
    globalThis.vocespaceSocketServer
      ?.to(`space:${entry.spaceName}`)
      .emit('user_status_updated', { space: entry.spaceName });
    return ApiResponse.json({ success: true });
  }
  if (!entry || entry.state === 'cancelled') throw new AccessError(409, 'JOIN_CANCELLED');
  if (entry.state !== 'joined' && entry.expiresAt <= Date.now())
    throw new AccessError(410, 'JOIN_EXPIRED');
  const media = getConfig().livekit;
  const client = new RoomServiceClient(media.url.replace(/^ws/, 'http'), media.key, media.secret);
  const connected = (await client.listParticipants(entry.spaceName)).find(
    (p) => p.identity === entry!.identity,
  );
  let metadata: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(connected?.metadata || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      metadata = parsed as Record<string, unknown>;
    }
  } catch {
    /* Deny below. */
  }
  if (!connected || metadata.sessionId !== principal.id || metadata.nativeJoinId !== joinId) {
    throw new AccessError(409, 'RTC_NOT_CONNECTED');
  }
  const settings = structuredClone(DEFAULT_PARTICIPANT_SETTINGS);
  settings.name = entry.nickname;
  settings.startAt = Date.now();
  settings.auth = { identity: 'guest', platform: 'other' };
  settings.ai.cut.enabled = false;
  let outcome: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const raw = await redis.get(`space:${entry.spaceName}`);
    if (!raw) throw new AccessError(409, 'JOIN_NO_LONGER_ALLOWED');
    const space: SpaceInfo = JSON.parse(raw);
    if (!Array.isArray(space.children)) throw new StorageUnavailableError();
    if (
      entry.childRoom &&
      !space.children.some((child) => child.name === entry!.childRoom && !child.isPrivate)
    )
      throw new AccessError(409, 'JOIN_NO_LONGER_ALLOWED');
    const storedPreferences = await redis.get(
      `v1:native-preferences:${principal.id}:${entry.spaceName}`,
    );
    const owns =
      !!entry.ownerIdentity &&
      space.ownerId === entry.ownerIdentity &&
      (await redis.get(nativeOwnerKey(principal.id, entry.spaceName))) === entry.ownerIdentity;
    if (owns) space.ownerId = entry.identity;
    const ownSettings = {
      ...settings,
      ...(storedPreferences ? JSON.parse(storedPreferences) : {}),
    };
    ownSettings.name = entry.nickname;
    ownSettings.auth = {
      identity: space.ownerId === entry.identity ? 'owner' : 'guest',
      platform: 'other',
    };
    space.participants[entry.identity] = ownSettings;
    if (entry.childRoom) {
      const child = space.children.find((child) => child.name === entry!.childRoom)!;
      if (!child.participants.includes(entry.identity)) child.participants.push(entry.identity);
    }
    outcome = await redis.eval(
      `
    local raw=redis.call('GET',KEYS[1]); local sr=redis.call('GET',KEYS[2]); local pr=redis.call('GET',KEYS[3]);
    if not raw or not sr or not pr then return 0 end
    local e=cjson.decode(raw); local s=cjson.decode(sr); local p=cjson.decode(pr)
    if e.state=='cancelled' or p.identities[e.spaceName]~=e.identity then return 0 end
    local owns=e.ownerIdentity and s.ownerId==e.ownerIdentity and redis.call('GET',KEYS[5])==e.ownerIdentity
    if (s.allowGuest~='allow' and s.ownerId~=e.identity and not owns) or redis.call('EXISTS',KEYS[4])==1 then return 0 end
    local found=not e.childRoom
    for _,child in ipairs(s.children) do
      if child.name==e.childRoom then
        if child.isPrivate then return 0 end
        found=true
      end
    end
    if not found then return 0 end
    if e.state=='joined' then return 1 end
    if e.expiresAt<=tonumber(ARGV[2]) then return 0 end
    if sr~=ARGV[4] then return 2 end
    e.state='joined'
    if owns then redis.call('SET',KEYS[5],e.identity,'EX',ARGV[3]) end
    redis.call('SET',KEYS[2],ARGV[1]); redis.call('SET',KEYS[1],cjson.encode(e),'EX',ARGV[3]); return 1`,
      5,
      key,
      `space:${entry.spaceName}`,
      `v1:session:${token}`,
      `v1:revoked:${entry.spaceName}:${entry.identity}`,
      nativeOwnerKey(principal.id, entry.spaceName),
      JSON.stringify(space),
      Date.now(),
      Math.max(1, Math.ceil((principal.expiresAt - Date.now()) / 1000)),
      raw,
    );
    if (outcome !== 2) break;
  }
  if (outcome === 2) throw new StorageUnavailableError();
  if (outcome !== 1) throw new AccessError(409, 'JOIN_NO_LONGER_ALLOWED');
  const confirmed = await spaceRepository.get(entry.spaceName);
  if (confirmed?.ownerId === entry.identity) {
    await client.updateParticipant(entry.spaceName, entry.identity, {
      permission: {
        canPublish: true,
        canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE],
        canSubscribe: true,
        canPublishData: false,
        canUpdateMetadata: false,
      },
    });
    const current = await sessions.read(token);
    if (!current || JSON.parse((await redis.get(key)) || '{}').state !== 'joined') {
      await client.removeParticipant(entry.spaceName, entry.identity);
      throw new AccessError(409, 'JOIN_CANCELLED');
    }
  }
  globalThis.vocespaceSocketServer
    ?.to(`space:${entry.spaceName}`)
    .emit('user_status_updated', { space: entry.spaceName });
  return ApiResponse.json({ joined: true });
}
