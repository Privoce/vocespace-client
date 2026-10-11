import { sessions } from './lib/server/sessions';
import { AccessError } from './access';
import { ApiRequest, ApiResponse } from './http';

/** Native transport never reflects an HttpOnly browser cookie into a JSON token. */
export function nativeToken(request: ApiRequest) {
  if (request.headers.has('origin') || request.headers.has('sec-fetch-site')) {
    throw new AccessError(403, 'NATIVE_TRANSPORT_REQUIRED');
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    throw new AccessError(415, 'JSON_REQUIRED');
  }
  const header = request.headers.get('authorization');
  if (header && !/^Bearer [a-f0-9]{64}$/.test(header))
    throw new AccessError(401, 'SESSION_REQUIRED');
  return header?.slice(7);
}
export async function requireNative(request: ApiRequest) {
  const token = nativeToken(request);
  const principal = await sessions.read(token);
  if (!token || !principal || principal.client !== 'native')
    throw new AccessError(401, 'SESSION_REQUIRED');
  return { token, principal };
}
export async function nativeSessionEndpoint(request: ApiRequest) {
  const token = nativeToken(request);
  if (request.method === 'DELETE') {
    if (token) {
      const principal = await sessions.read(token);
      // Unknown/already revoked tokens are idempotent; never revoke a browser principal.
      if (principal && principal.client !== 'native')
        throw new AccessError(403, 'NATIVE_SESSION_REQUIRED');
      await sessions.revoke(token);
      if (principal)
        for (const socket of globalThis.vocespaceSocketServer?.sockets.sockets.values() || []) {
          if (socket.data.sessionId === principal.id) socket.disconnect(true);
        }
    }
    return ApiResponse.json({ success: true });
  }
  if (request.method !== 'POST') return new ApiResponse(null, { status: 405 });
  const body = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) {
    throw new AccessError(400, 'INVALID_SESSION_REQUEST');
  }
  if (token) {
    const { principal } = await requireNative(request);
    return ApiResponse.json({ accessToken: token, expiresAt: principal.expiresAt });
  }
  const fresh = await sessions.create();
  fresh.principal.client = 'native';
  await sessions.save(fresh.token, fresh.principal);
  return ApiResponse.json({ accessToken: fresh.token, expiresAt: fresh.principal.expiresAt });
}
