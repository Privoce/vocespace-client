import {
  parseJoinId,
  parseNativeSettingsSnapshot,
  parseNativeSettingsPatch,
  nativePreferenceKeys,
} from '@vocespace/contracts';
import { DEFAULT_PARTICIPANT_SETTINGS, type SpaceInfo } from '@vocespace/domain/space';
import { StorageUnavailableError } from '@vocespace/server-core';
import { requireNativeChatMember } from './lib/server/native-chat';
import { spaceRepository } from './lib/server/space-repository';
import { getSpaceRedisClient } from './lib/server/space-redis';
import { requireNative } from './native-auth';
import { ApiRequest, ApiResponse } from './http';
import { AccessError } from './access';
import { RoomServiceClient } from 'livekit-server-sdk';
import { getConfig } from './lib/server/config';

export function settingsSnapshot(info: SpaceInfo, identity: string) {
  const raw = info.participants[identity];
  if (!raw) throw new AccessError(403, 'SETTINGS_MEMBERSHIP_REQUIRED');
  const defaults = DEFAULT_PARTICIPANT_SETTINGS;
  const participant = {
    ...defaults,
    ...raw,
    audioProcessing: { ...defaults.audioProcessing, ...raw.audioProcessing },
    virtual: { ...defaults.virtual, ...raw.virtual },
  };
  const role = participant.auth?.identity;
  const permissionRole =
    role === 'owner' || role === 'manager' || role === 'participant' ? role : 'guest';
  const isOwner = info.ownerId === identity;
  const isManager = isOwner || !!info.managers?.includes(identity);
  return parseNativeSettingsSnapshot({
    ...participant,
    permissions: info.auth,
    ...(typeof info.persistence === 'boolean'
      ? {
          room: {
            isOwner,
            isManager,
            persistence: info.persistence,
            allowGuest: info.allowGuest,
            apps: info.apps,
            canReadRecordings: isManager || !!info.auth[permissionRole]?.recording,
          },
        }
      : {}),
  });
}

/** Membership and per-field authorization are evaluated on every read/write. */
export async function nativeSettingsEndpoint(request: ApiRequest) {
  const { token, principal } = await requireNative(request);
  if (!['POST', 'PUT'].includes(request.method)) return new ApiResponse(null, { status: 405 });
  const body = await request.json();
  const joinId = parseJoinId(body);
  const access = await requireNativeChatMember(principal, joinId);
  if (request.method === 'PUT') {
    if (!body.patch || typeof body.patch !== 'object' || Array.isArray(body.patch))
      throw new AccessError(400, 'INVALID_NATIVE_SETTINGS');
    const redis = getSpaceRedisClient();
    if (!redis) throw new StorageUnavailableError();
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await requireNative(request);
      await requireNativeChatMember(current.principal, joinId);
      const raw = await redis.get(`space:${access.spaceName}`);
      if (!raw) throw new AccessError(403, 'SETTINGS_MEMBERSHIP_REQUIRED');
      const info: SpaceInfo = JSON.parse(raw);
      const snapshot = settingsSnapshot(info, access.identity);
      const patch = parseNativeSettingsPatch(body.patch, snapshot);
      const owns = info.ownerId === access.identity;
      if (['permissions', 'persistence', 'allowGuest', 'apps'].some((key) => key in patch) && !owns)
        throw new AccessError(403, 'OWNER_REQUIRED');
      if (
        patch.name &&
        Object.entries(info.participants).some(
          ([id, p]) => id !== access.identity && p.name === patch.name,
        )
      )
        throw new AccessError(409, 'NAME_TAKEN');
      const participant = info.participants[access.identity];
      for (const key of nativePreferenceKeys)
        if (key in patch) Object.assign(participant, { [key]: patch[key] });
      if (patch.permissions) info.auth = patch.permissions;
      if (patch.persistence !== undefined) info.persistence = patch.persistence;
      if (patch.allowGuest !== undefined) info.allowGuest = patch.allowGuest;
      if (patch.apps) info.apps = patch.apps;
      const preferences = Object.fromEntries(
        nativePreferenceKeys.map((key) => [key, participant[key]]),
      );
      const result = await redis.eval(
        `
        local sr=redis.call('GET',KEYS[2]); local jr=redis.call('GET',KEYS[3]);
        if not sr or not jr or redis.call('EXISTS',KEYS[4])==1 then return -1 end
        local session=cjson.decode(sr); local entry=cjson.decode(jr)
        if entry.state~='joined' or session.identities[ARGV[4]]~=ARGV[5] then return -1 end
        if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
        redis.call('SET',KEYS[1],ARGV[2]); redis.call('SET',KEYS[5],ARGV[3],'EX',ARGV[6]); return 1`,
        5,
        `space:${access.spaceName}`,
        `v1:session:${token}`,
        `v1:native-join:${principal.id}:${joinId}`,
        `v1:revoked:${access.spaceName}:${access.identity}`,
        `v1:native-preferences:${principal.id}:${access.spaceName}`,
        raw,
        JSON.stringify(info),
        JSON.stringify(preferences),
        access.spaceName,
        access.identity,
        Math.max(1, Math.ceil((principal.expiresAt - Date.now()) / 1000)),
      );
      if (result === -1) throw new AccessError(403, 'SETTINGS_MEMBERSHIP_REQUIRED');
      if (result === 0) continue;
      if (patch.name !== undefined) {
        const media = getConfig().livekit;
        const client = new RoomServiceClient(
          media.url.replace(/^ws/, 'http'),
          media.key,
          media.secret,
        );
        await client.updateParticipant(access.spaceName, access.identity, { name: patch.name });
      }
      globalThis.vocespaceSocketServer
        ?.to(`space:${access.spaceName}`)
        .emit('user_status_updated', { space: access.spaceName });
      return ApiResponse.json(settingsSnapshot(info, access.identity));
    }
    throw new StorageUnavailableError();
  }
  const info = await spaceRepository.get(access.spaceName);
  if (!info) throw new AccessError(403, 'SETTINGS_MEMBERSHIP_REQUIRED');
  const snapshot = settingsSnapshot(info, access.identity);
  const current = await requireNative(request);
  await requireNativeChatMember(current.principal, joinId);
  return ApiResponse.json(snapshot);
}
