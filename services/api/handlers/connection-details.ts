import { getSpaceRedisClient } from '../lib/server/space-redis';
import { randomBytes } from 'node:crypto';
import { ApiRequest, ApiResponse } from '../http';
import { getConfig } from '../lib/server/config';
import { generateToken, parseToken } from '../lib/server/platform-token';
import { verifyTokenResult } from '@vocespace/domain';
import type { TokenResult } from '@vocespace/domain';
import { sessions, sessionToken, sessionCookie } from '../lib/server/sessions';
import { spaceRepository } from '../lib/server/space-repository';
import { createLegacyConnection } from '../lib/server/legacy-connection';
import { canCreateSpace } from '@vocespace/server-core';
import { parseConnectionRequest } from '@vocespace/contracts';
import { safeSegment } from '../access';

export async function GET(request: ApiRequest) {
  const query = request.nextUrl.searchParams;
  if (query.has('auth')) {
    let platform: TokenResult;
    try { platform = parseToken(query.get('token') || ''); }
    catch { return ApiResponse.json({ code: 'INVALID_PLATFORM_TOKEN' }, { status: 401 }); }
    if (!safeSegment(platform.space)) return new ApiResponse(null, { status: 400 });
    const code = await sessions.code({ ...platform, auth: query.get('auth') });
    const url = new URL(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/${encodeURIComponent(platform.space)}`, request.nextUrl.origin);
    url.searchParams.set('code', code);
    const headers = { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };
    return query.get('fromServer') === 'true' ? ApiResponse.json({ redirectUrl: url.toString() }, { headers }) : ApiResponse.redirect(url, { headers, status: 303 });
  }
  let input;
  try { input = parseConnectionRequest(Object.fromEntries(query)); }
  catch { return ApiResponse.json({ code: 'INVALID_CONNECTION' }, { status: 400 }); }
  if (!safeSegment(input.spaceName)) return new ApiResponse(null, { status: 400 });
  let token = sessionToken(request.headers);
  let principal = await sessions.read(token);
  if (!principal) { const fresh = await sessions.create(); token = fresh.token; principal = fresh.principal; }
  const space = await spaceRepository.get(input.spaceName);
  const platform = principal.platform?.space === input.spaceName ? principal.platform : undefined;
  const conf = getConfig();
  if (!space && !canCreateSpace({ mode: conf.create_space, name: input.participantName, platformIdentity: platform?.id, whiteList: conf.whiteList })) {
    return ApiResponse.json({ code: 'CREATE_DENIED' }, { status: 403 });
  }
  if (space && (space.allowGuest === 'disable' && (!platform || platform.auth === 'other') || space.allowGuest === 'link' && !platform)) return ApiResponse.json({ code: 'GUEST_DENIED' }, { status: 403 });
  const identity = platform?.id || principal.identities[input.spaceName] || `guest_${randomBytes(12).toString('hex')}`;
  if (await getSpaceRedisClient()?.get(`v1:revoked:${input.spaceName}:${identity}`)) return ApiResponse.json({ code: 'MEMBERSHIP_REVOKED' }, { status: 403 });
  principal.identities[input.spaceName] = identity;
  await sessions.save(token!, principal);
  const details = await createLegacyConnection().issueParticipant({ identity,
    name: platform?.username || input.participantName, roomName: input.spaceName,
    metadata: JSON.stringify({ sessionId: principal.id, platform: platform?.auth || 'other' }),
  });
  return ApiResponse.json(details, { headers: { 'Set-Cookie': sessionCookie(token!, request.url) } });
}

/** Administrative integration helper; guarded by the common dispatcher. */
export async function POST(request: ApiRequest) {
  const payload = await request.json();
  if (!verifyTokenResult(payload)) return new ApiResponse('Invalid token payload', { status: 400 });
  return ApiResponse.json({ token: generateToken(payload) });
}
