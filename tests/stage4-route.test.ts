// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { ApiRequest } from '@/services/api/http';
import { createSessionService } from '@vocespace/server-core';
import { randomBytes } from 'node:crypto';

const fixture = vi.hoisted(() => ({ createMode: 'all', exists: false, values: new Map<string,string>() }));
vi.mock('../services/api/lib/server/space-redis', () => ({ getSpaceRedisClient: () => null }));
vi.mock('../services/api/lib/server/config', () => ({ getConfig: () => ({ create_space: fixture.createMode, whiteList: [],
  livekit: { url: 'wss://test.invalid', key: 'test-only', secret: 'test-only-secret-never-production-123456' } }) }));
vi.mock('../services/api/lib/server/space-repository', () => ({ spaceRepository: { get: async () => fixture.exists ? { allowGuest: 'allow', participants: {} } : null } }));
vi.mock('../services/api/lib/server/sessions', async () => {
  const actual = await vi.importActual<typeof import('../services/api/lib/server/sessions')>('../services/api/lib/server/sessions');
  return { ...actual, sessions: createSessionService({
    read: async (k) => fixture.values.get(k) || null,
    write: async (k,v) => { fixture.values.set(k,v); },
    consume: async (k) => { const v=fixture.values.get(k); fixture.values.delete(k); return v || null; },
    remove: async (k) => { fixture.values.delete(k); },
  }, () => randomBytes(32).toString('hex')) };
});
import { GET } from '@/services/api/handlers/connection-details';
import { sessionEndpoint } from '@/services/api/auth';
import jwt from 'jsonwebtoken';
beforeEach(() => { fixture.values.clear(); fixture.exists=false; fixture.createMode='all'; vi.stubEnv('PLATFORM_JWT_SECRET','test-only-signing-key-with-32-characters'); });

it('issues a server-selected identity, secure cookie, and short RTC grants', async () => {
  const response = await GET(new ApiRequest('https://web.test/api/connection-details?spaceName=room&participantName=Alice&identity=owner'));
  expect(response.status).toBe(200);
  const body = await response.json();
  const claims = jwt.decode(body.participantToken) as jwt.JwtPayload;
  expect(claims.sub).toMatch(/^guest_/);
  expect(claims.sub).not.toBe('owner');
  expect(claims.exp! - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(301);
  expect(claims.video).toMatchObject({ room: 'room', roomJoin: true });
  expect(response.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Lax');
});
it('does not permit arbitrary identity to bypass platform-only creation', async () => {
  fixture.createMode='white_platform';
  const response = await GET(new ApiRequest('https://web.test/api/connection-details?spaceName=room&participantName=Alice&identity=admin'));
  expect(response.status).toBe(403);
});
it('rejects malformed connection input', async () => {
  expect((await GET(new ApiRequest('https://web.test/api/connection-details?spaceName=room'))).status).toBe(400);
});
it('rejects an unsigned or incorrectly signed platform token', async () => {
  const token=jwt.sign({ id:'owner',space:'room',username:'Alice',exp:9999999999 },'wrong');
  expect((await GET(new ApiRequest(`https://web.test/api/connection-details?auth=space&token=${token}`))).status).toBe(401);
});
it('uses a one-time code instead of identity or RTC credentials in a redirect', async () => {
  const token=jwt.sign({ id:'platform-id',space:'room',username:'Alice',exp:9999999999 },process.env.PLATFORM_JWT_SECRET!);
  const response=await GET(new ApiRequest(`https://web.test/api/connection-details?auth=space&token=${token}&fromServer=true`));
  const url=new URL((await response.json()).redirectUrl);
  expect([...url.searchParams.keys()]).toEqual(['code']);
  const request=() => new ApiRequest('https://web.test/api/v1/session',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:url.searchParams.get('code')}) });
  const first=await sessionEndpoint(request());
  expect(first.status).toBe(200);
  expect((await first.json()).platform.id).toBe('platform-id');
  expect((await sessionEndpoint(request())).status).toBe(401);
});
