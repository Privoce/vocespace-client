import { sessions, sessionToken, sessionCookie } from './lib/server/sessions';
import { ApiRequest, ApiResponse } from './http';
import type { SessionPrincipal } from '@vocespace/server-core';

export async function sessionEndpoint(request: ApiRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    return ApiResponse.json({ code: 'ORIGIN_DENIED' }, { status: 403 });
  }
  const currentToken = sessionToken(request.headers);
  if (request.method === 'DELETE') {
    if (currentToken) {
      const principal = await sessions.read(currentToken);
      await sessions.revoke(currentToken);
      if (principal) for (const socket of globalThis.vocespaceSocketServer?.sockets.sockets.values() || []) {
        if (socket.data.sessionId === principal.id) socket.disconnect(true);
      }
    }
    return ApiResponse.json({ success: true }, { headers: { 'Set-Cookie': 'vocespace_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' } });
  }
  if (request.method !== 'POST' && request.method !== 'GET') return new ApiResponse(null, { status: 405 });
  if (request.method === 'POST') {
    const body = await request.json();
    if (body.code) {
      const platform = await sessions.exchange(body.code) as SessionPrincipal['platform'];
      if (!platform || platform.exp * 1000 <= Date.now()) return ApiResponse.json({ code: 'INVALID_CODE' }, { status: 401 });
      const { token, principal } = await sessions.create();
      principal.platform = platform;
      principal.identities[platform.space] = platform.id;
      principal.expiresAt = Math.min(principal.expiresAt, platform.exp * 1000);
      await sessions.save(token, principal);
      if (currentToken) await sessions.revoke(currentToken);
      return ApiResponse.json({ platform }, { headers: { 'Set-Cookie': sessionCookie(token, request.url) } });
    }
  }
  const existing = await sessions.read(currentToken);
  if (existing) return ApiResponse.json({ platform: existing.platform || null });
  const { token } = await sessions.create();
  return ApiResponse.json({ platform: null }, { headers: { 'Set-Cookie': sessionCookie(token, request.url) } });
}

/** Preferred platform entry: credentials stay in the POST body; only the code is redirected. */
export async function platformLoginEndpoint(request: ApiRequest) {
  if (request.method !== 'POST') return new ApiResponse(null, { status: 405 });
  const body = await request.json();
  if (typeof body.token !== 'string' || typeof body.auth !== 'string') return ApiResponse.json({ code: 'INVALID_PLATFORM_REQUEST' }, { status: 400 });
  const url = new URL('/api/connection-details', request.url);
  url.searchParams.set('token', body.token);
  url.searchParams.set('auth', body.auth);
  url.searchParams.set('fromServer', 'true');
  const { GET } = await import('./handlers/connection-details');
  return GET(new ApiRequest(url, { headers: request.headers }));
}
