import { randomBytes } from 'node:crypto';
import { getConfig } from './lib/server/config';
import { canCreateSpace } from '@vocespace/server-core';
import { spaceAccess } from '@vocespace/server-core';
import type { SessionPrincipal } from '@vocespace/server-core';
import { sessions, sessionToken } from './lib/server/sessions';
import { verifyHostToken } from './lib/server/host-authorization';
import { spaceRepository } from './lib/server/space-repository';
import { ApiRequest } from './http';

export class AccessError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export function safeSegment(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 &&
    !/[\\/\0]/.test(value) && !['.', '..', '__proto__', 'constructor', 'prototype'].includes(value);
}
export async function membership(principal: SessionPrincipal, space: string) {
  const id = principal.identities[space];
  const info = await spaceRepository.get(space);
  if (!id || !info) throw new AccessError(403, 'SPACE_ACCESS_DENIED');
  const participant = info.participants[id];
  return { id, info, participant, manager: principal.client !== 'native' && (info.ownerId === id || info.managers.includes(id)) };
}

/** Applies equally to v1 and compatibility endpoints. No identity supplied by the caller is trusted. */
export async function authorizeRequest(request: ApiRequest, path: string) {
  const url = request.nextUrl;
  const q = url.searchParams;
  const method = request.method;
  const origin = request.headers.get('origin');
  // GET compatibility actions can also mutate; enforce origin on all browser requests.
  if (origin && origin !== request.nextUrl.origin) throw new AccessError(403, 'ORIGIN_DENIED');
  if (request.headers.get('sec-fetch-site') === 'cross-site' && path !== '/api/connection-details') {
    throw new AccessError(403, 'ORIGIN_DENIED');
  }
  let body: Record<string, any> = {};
  if (request.headers.get('content-type')?.includes('application/json')) {
    try { body = await request.clone().json(); } catch { throw new AccessError(400, 'INVALID_JSON'); }
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new AccessError(400, 'INVALID_BODY');
  } else if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    const form = await request.clone().formData();
    body = Object.fromEntries(form);
  }
  const admin = verifyHostToken(request.headers.get('x-vocespace-host-token') || body.hostToken);
  const onlyQuery = (...keys: string[]) => [...q.keys()].every((key) => keys.includes(key));
  const publicRead = path === '/api/hello' || path === '/api/webhook/status' ||
    path === '/api/connection-details' && method === 'GET' ||
    path === '/api/conf' && (method === 'GET' || q.has('check') && onlyQuery('check') || q.has('setup') && onlyQuery('setup')) ||
    path === '/api/space' && (method === 'GET' && q.has('pre') && onlyQuery('pre','spaceName') || method === 'POST' && q.has('nameCheck') && onlyQuery('nameCheck')) ||
    path === '/api/record' && method === 'GET' && q.has('env') ||
    path === '/api/s3' && q.get('action') === 'connect' ||
    path === '/api/webhook' && method === 'POST'; // Stripe adapter verifies raw signature.
  if (publicRead) return request;
  if (admin) return request;
  if (method === 'GET' && (q.get('space') === 'create' || q.has('clearHeartbeatLog') || q.has('clearCleanupRecords')) &&
      !origin && request.headers.get('x-vocespace-request') !== '1' && !request.headers.get('authorization')) {
    throw new AccessError(403, 'CSRF_HEADER_REQUIRED');
  }
  if (path === '/api/license' || path.startsWith('/api/license/') || path === '/api/webhook' ||
    path === '/api/conf' || path === '/api/connection-details' ||
    ['all','timeRecord','heartbeat','heartbeatLog','clearHeartbeatLog','cleanupRecords','clearCleanupRecords','flushdb','socketId'].some((k) => q.has(k))) {
    throw new AccessError(403, 'ADMIN_REQUIRED');
  }
  const principal = await sessions.read(sessionToken(request.headers));
  if (!principal) throw new AccessError(401, 'SESSION_REQUIRED');
  if (path === '/api/feedback' || path === '/api/chat') return request;
  const fileSpace = path.startsWith('/api/files/') ? decodeURIComponent(path.split('/')[3]) : undefined;
  const space = body.spaceName || body.space || body.roomName || q.get('spaceName') || q.get('owner') || q.get('room') ||
    q.get('key')?.split('/')[0] || fileSpace;
  if (!safeSegment(space)) throw new AccessError(400, 'INVALID_SPACE');
  for (const key of ['fileName', 'roomName', 'room']) if (body[key] !== undefined && !(key === 'room' && body[key] === '') && !safeSegment(body[key])) throw new AccessError(400, 'INVALID_PATH');
  if (q.has('key') && q.get('key')!.split('/').some((v) => !safeSegment(v))) throw new AccessError(400, 'INVALID_PATH');
  if (path.startsWith('/api/files/') && path.split('/').slice(3).some((v) => !safeSegment(decodeURIComponent(v)))) throw new AccessError(400, 'INVALID_PATH');
  const info = await spaceRepository.get(space);
  if (path === '/api/space' && q.get('space') === 'create' && method === 'GET') {
    const conf = getConfig();
    const platform = principal.platform?.space === space ? principal.platform : undefined;
    if (!canCreateSpace({ mode: conf.create_space, name: q.get('owner') || '', platformIdentity: platform?.id, whiteList: conf.whiteList })) throw new AccessError(403, 'CREATE_DENIED');
    principal.identities[space] ||= platform?.id || `guest_${randomBytes(12).toString('hex')}`;
    await sessions.save(sessionToken(request.headers)!, principal);
    return request;
  }
  const id = principal.identities[space];
  if (path === '/api/space' && q.get('enter') === 'link' && q.get('childRoom') === 'true' && method === 'POST') {
    if (!info || info.allowGuest === 'disable' && !principal.platform) throw new AccessError(403, 'GUEST_DENIED');
    const room = info.children.find((child) => child.name === body.room);
    if (!room || room.isPrivate && room.ownerId !== body.roomOwner) throw new AccessError(403, 'INVALID_INVITE');
    return request;
  }
  // Public pre-join read exposes configuration only; dispatch filters the response below.
  if (path === '/api/space' && method === 'GET' && !q.has('chat') && !q.has('space')) return request;
  if (!id) throw new AccessError(403, 'SPACE_ACCESS_DENIED');
  const { manager } = spaceAccess(info, id);
  const fileRoom = path.startsWith('/api/files/') && path.split('/').length > 5 ? decodeURIComponent(path.split('/')[4]) : body.room;
  const privateRoom = info?.children.find((child) => child.name === fileRoom && child.isPrivate);
  if (privateRoom && !manager && privateRoom.ownerId !== id && !privateRoom.participants.includes(id)) throw new AccessError(403, 'PRIVATE_ROOM');
  const init = path === '/api/space' && q.get('participant') === 'update' && body.init;
  if (!info?.participants[id] && !init && !(path === '/api/space' && q.get('space') === 'create')) throw new AccessError(403, 'MEMBERSHIP_REQUIRED');
  const targets = [body.participantId, body.userId, body.uid, body.senderId, body.identity, q.get('userId')].filter(Boolean);
  if (targets.some((target) => target !== id) && !manager) throw new AccessError(403, 'IDENTITY_MISMATCH');
  const management = path === '/api/record' && method !== 'GET' || path === '/api/s3' && method === 'DELETE' ||
    path === '/api/space' && (q.has('ownerId') || q.has('auth') || q.has('persistence') || q.has('allowGuest') || q.has('record') ||
      q.has('update') || q.has('delete') || q.get('apps') === 'update');
  if (management && !manager) throw new AccessError(403, 'MANAGER_REQUIRED');
  if (q.has('ownerId') || q.get('auth') === 'manage') {
    if (info?.ownerId !== id) throw new AccessError(403, 'OWNER_REQUIRED');
  }
  if (body.info) {
    for (const protectedField of ['ownerId', 'managers', 'participants', 'auth', 'children', 'startAt']) {
      if (protectedField in body.info) throw new AccessError(403, 'PROTECTED_SPACE_FIELD');
    }
  }
  if (path === '/api/upload' && !q.has('tilePlayer') && ['rm', 'rm -a'].includes(body.ty) && !manager) {
    // File ownership is encoded in filenames; complete-room removal always requires management.
    if (body.ty === 'rm -a' || !body.fileName?.startsWith(`${id}_`)) throw new AccessError(403, 'FILE_OWNER_REQUIRED');
  }
  if (init && body.participantId !== id) throw new AccessError(403, 'IDENTITY_MISMATCH');
  if (body.settings) {
    // Authentication/roles come from the verified session and stored room ownership.
    const old = info?.participants[body.participantId || id];
    body.settings.auth = old?.auth || { platform: principal.platform?.auth || 'other',
      identity: principal.platform?.identity || 'guest' };
    if (body.participantId && body.participantId !== id) {
      body.settings.socketId = old?.socketId || '';
    } else if (body.settings.socketId) {
      const socket = globalThis.vocespaceSocketServer?.sockets.sockets.get(body.settings.socketId);
      if (!socket || socket.data.sessionId !== principal.id) throw new AccessError(403, 'SOCKET_MISMATCH');
    }
  }
  if (path === '/api/ai') { body.isAuth = !!principal.platform; q.set('isAuth', String(!!principal.platform)); }
  if (q.get('enter') === 'true') {
    body.uid = id; body.identity = principal.platform?.identity || 'guest'; body.auth = principal.platform?.auth || 'other';
  }
  if (q.has('childRoom') && info) {
    if (method === 'POST' && !q.has('enter') && !manager) {
      const role = info.participants[id]?.auth?.identity || 'guest';
      if (!info.auth[role as keyof typeof info.auth]?.createRoom) throw new AccessError(403, 'CREATE_ROOM_DENIED');
    }
    const child = info.children.find((room) => room.name === (body.roomName || body.room));
    const owns = child?.ownerId === id;
    if (['update','delete'].includes(q.get('childRoom') || '') && !manager && !owns) throw new AccessError(403, 'ROOM_OWNER_REQUIRED');
    if (child?.isPrivate && !manager && !owns && !child.participants.includes(id)) throw new AccessError(403, 'PRIVATE_ROOM');
  }
  if (request.headers.get('content-type')?.includes('application/json')) {
    return new ApiRequest(url, { method, headers: request.headers, body: JSON.stringify(body), signal: request.signal });
  }
  if (url.toString() !== request.url && ['GET', 'HEAD'].includes(method)) return new ApiRequest(url, { method, headers: request.headers, signal: request.signal });
  return request;
}
