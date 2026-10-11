import { randomUUID } from 'node:crypto';
import { RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import {
  parseNativeMediaStatus,
  type NativeDevice,
  type NativeMediaInvitation,
} from '@vocespace/contracts';
import {
  canAcceptNativeInvitation,
  StorageUnavailableError,
  type SessionPrincipal,
} from '@vocespace/server-core';
import { requireNativeChatMember } from './native-chat';
import { getSpaceRedisClient } from './space-redis';
import { spaceRepository } from './space-repository';
import { sessions } from './sessions';
import { getConfig } from './config';
import { withMediaMember } from './media-lock';
import { AccessError } from '../../access';

const sources = { microphone: TrackSource.MICROPHONE, camera: TrackSource.CAMERA, screen: TrackSource.SCREEN_SHARE };
const devices = Object.keys(sources) as NativeDevice[];
const inviteKey = (principal: SessionPrincipal, joinId: string, device: NativeDevice) =>
  `v1:native-invite:${principal.id}:${joinId}:${device}`;
function mediaClient() {
  const media = getConfig().livekit;
  return new RoomServiceClient(media.url.replace(/^ws/, 'http'), media.key, media.secret);
}
async function readInvitation(
  principal: SessionPrincipal,
  joinId: string,
  device: NativeDevice,
  space: string,
) {
  const redis = getSpaceRedisClient();
  if (!redis) throw new StorageUnavailableError();
  const raw = await redis.get(inviteKey(principal, joinId, device));
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw);
    const invitation = parseNativeMediaStatus({ sources: [], invitations: [stored] })
      .invitations[0];
    const room = await spaceRepository.get(space);
    const issuer = await sessions.read(stored.issuerToken);
    const id = issuer?.identities[space];
    const authorized =
      !!id &&
      issuer?.client !== 'native' &&
      !!room?.participants[id] &&
      (room.ownerId === id || room.managers.includes(id));
    return { invitation, authorized };
  } catch (error) {
    if (error instanceof StorageUnavailableError) throw error;
    throw new StorageUnavailableError();
  }
}
async function connected(principal: SessionPrincipal, joinId: string) {
  const access = await requireNativeChatMember(principal, joinId);
  const client = mediaClient();
  const participant = (await client.listParticipants(access.spaceName)).find(
    (p) => p.identity === access.identity,
  );
  let metadata;
  try {
    metadata = JSON.parse(participant?.metadata || 'null');
  } catch {
    /* Deny below. */
  }
  if (!participant || metadata?.sessionId !== principal.id || metadata?.nativeJoinId !== joinId)
    throw new AccessError(409, 'RTC_NOT_CONNECTED');
  return { access, client, participant };
}
function allowed(participant: Awaited<ReturnType<typeof connected>>['participant']) {
  return devices.filter(
    (d) =>
      participant.permission?.canPublish &&
      participant.permission.canPublishSources.includes(sources[d]),
  );
}
export async function nativeMediaStatus(principal: SessionPrincipal, joinId: string) {
  const { access, participant } = await connected(principal, joinId);
  const invitations: NativeMediaInvitation[] = [];
  for (const device of devices) {
    const stored = await readInvitation(principal, joinId, device, access.spaceName);
    if (stored?.authorized && stored.invitation.expiresAt > Date.now())
      invitations.push(stored.invitation);
  }
  return { sources: allowed(participant), invitations };
}
export async function enableNativeMedia(
  token: string,
  principal: SessionPrincipal,
  joinId: string,
  device: NativeDevice,
  invitationId: string,
) {
  const access = await requireNativeChatMember(principal, joinId);
  return withMediaMember(access.spaceName, access.identity, async () => {
    const fresh = await sessions.read(token);
    if (!fresh) throw new AccessError(401, 'SESSION_REQUIRED');
    const { client, participant } = await connected(fresh, joinId);
    const granted = allowed(participant);
    if (!granted.includes(device)) {
      const stored = await readInvitation(fresh, joinId, device, access.spaceName);
      if (
        !canAcceptNativeInvitation(
          stored?.invitation || null,
          device,
          invitationId,
          !!stored?.authorized,
          Date.now(),
        )
      )
        throw new AccessError(403, 'MEDIA_INVITATION_REQUIRED');
      granted.push(device);
      await client.updateParticipant(access.spaceName, access.identity, {
        permission: {
          canPublish: true,
          canPublishSources: granted.map((d) => sources[d]),
          canPublishData: false,
          canSubscribe: true,
          canUpdateMetadata: false,
        },
      });
      // A cancellation/session revocation may have arrived during the media RPC.
      try {
        const current = await sessions.read(token);
        if (!current) throw new AccessError(401, 'SESSION_REQUIRED');
        await requireNativeChatMember(current, joinId);
      } catch (error) {
        await client.removeParticipant(access.spaceName, access.identity);
        throw error;
      }
      await getSpaceRedisClient()!.del(inviteKey(fresh, joinId, device));
    }
    return nativeMediaStatus(fresh, joinId);
  });
}
/** Called only after Web management authorization. Never starts the user's capture device. */
export async function inviteNativeMedia(
  principal: SessionPrincipal,
  joinId: string,
  issuerToken: string,
  senderName: string,
  device: NativeDevice,
) {
  await requireNativeChatMember(principal, joinId);
  const invitation: NativeMediaInvitation = {
    id: randomUUID(),
    device,
    senderName,
    expiresAt: Date.now() + 60_000,
  };
  const redis = getSpaceRedisClient();
  if (!redis) throw new StorageUnavailableError();
  await redis.set(
    inviteKey(principal, joinId, device),
    JSON.stringify({ ...invitation, issuerToken }),
    'EX',
    60,
  );
  return invitation;
}
export async function revokeNativeMedia(
  principal: SessionPrincipal,
  joinId: string,
  device: NativeDevice,
) {
  const access = await requireNativeChatMember(principal, joinId);
  return withMediaMember(access.spaceName, access.identity, async () => {
    const { client, participant } = await connected(principal, joinId);
    const remaining = allowed(participant).filter((d) => d !== device);
    await getSpaceRedisClient()!.del(inviteKey(principal, joinId, device));
    await client.updateParticipant(access.spaceName, access.identity, {
      permission: {
        canPublish: remaining.length > 0,
        canPublishSources: remaining.map((d) => sources[d]),
        canPublishData: false,
        canSubscribe: true,
        canUpdateMetadata: false,
      },
    });
  });
}

/** Publish the current transport address for the existing Web participant menu, using CAS. */
export async function bindNativeSocket(
  principal: SessionPrincipal,
  joinId: string,
  socketId: string,
) {
  const access = await requireNativeChatMember(principal, joinId);
  const redis = getSpaceRedisClient();
  if (!redis) throw new StorageUnavailableError();
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = `space:${access.spaceName}`;
    const raw = await redis.get(key);
    if (!raw) throw new AccessError(403, 'CHAT_MEMBERSHIP_REQUIRED');
    const space = JSON.parse(raw);
    if (!space.participants[access.identity])
      throw new AccessError(403, 'CHAT_MEMBERSHIP_REQUIRED');
    space.participants[access.identity].socketId = socketId;
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
