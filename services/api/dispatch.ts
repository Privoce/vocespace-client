import { nativeSessionEndpoint } from './native-auth';
import { nativeConferenceEndpoint } from './native-conference';
import { ContractError } from '@vocespace/contracts';
import { spaceRepository } from '@/lib/server/space-repository';
import { sessions, sessionToken } from '@/lib/server/sessions';
import { proxyPlatform } from './handlers/platform';
import { authorizeRequest, AccessError } from './access';
import { sessionEndpoint, platformLoginEndpoint } from './auth';
import { randomUUID } from 'node:crypto';
import { routes } from './routes';
import { ApiRequest, ApiResponse } from './http';
import { StorageUnavailableError } from '@vocespace/server-core';

async function dispatchInternal(request: ApiRequest) {
  const requestId = randomUUID();
  try {
    let pathname = request.nextUrl.pathname;
    const prefix = process.env.NEXT_PUBLIC_BASE_PATH || '';
    if (prefix && pathname.startsWith(prefix + '/')) pathname = pathname.slice(prefix.length);
    pathname = pathname.replace(/^\/uploads\//, '/api/files/');
    pathname = pathname.replace(/^\/api\/v1\//, '/api/');
    if (pathname === '/healthz') return ApiResponse.json({ status: 'ok', apiVersion: 1 });
    if (pathname === '/api/session/native') return await nativeSessionEndpoint(request);
    if (pathname === '/api/native/conferences') return await nativeConferenceEndpoint(request);
    // Native observer credentials cannot obtain publishing grants or mutate through legacy routes.
    const suppliedToken = sessionToken(request.headers);
    if (suppliedToken && (await sessions.read(suppliedToken))?.client === 'native') {
      throw new AccessError(403, 'NATIVE_ENDPOINT_REQUIRED');
    }
    if (pathname === '/api/auth/platform') return await platformLoginEndpoint(request);
    if (pathname === '/api/session') return await sessionEndpoint(request);
    if (pathname === '/api/platform' || pathname.startsWith('/api/platform/')) {
      const origin = request.headers.get('origin');
      if (origin && origin !== request.nextUrl.origin) throw new AccessError(403, 'ORIGIN_DENIED');
      return await proxyPlatform(request, pathname.slice('/api/platform'.length));
    }
    request = await authorizeRequest(request, pathname);
    for (const route of routes) {
      const params: Record<string, string | string[]> = {};
      const pattern = route.path.replace('[...slug]', '(.*)').replace('[value]', '([^/]+)');
      const match = pathname.match(new RegExp(`^${pattern}$`));
      if (!match) continue;
      if (route.path.includes('[...slug]')) params.slug = match[1].split('/').map(decodeURIComponent);
      if (route.path.includes('[value]')) params.value = decodeURIComponent(match[1]);
      const handler = (route.handlers as unknown as Record<string, (req: ApiRequest, ctx: unknown) => Promise<Response>>)[request.method];
      if (!handler) return ApiResponse.json({ code: 'METHOD_NOT_ALLOWED', requestId }, { status: 405 });
      const auditRequest = new ApiRequest(request.clone());
      const response = await handler(request, { params });
      if (!response) throw new Error('Handler did not return a response');
      if (pathname === '/api/space' && response.ok && request.nextUrl.searchParams.has('participant')) {
        const principal = await sessions.read(sessionToken(request.headers));
        const body = await auditRequest.json().catch(() => ({}));
        if (principal && body.spaceName) {
          for (const socket of globalThis.vocespaceSocketServer?.sockets.sockets.values() || []) {
            const current = await sessions.read(socket.data.token);
            const space = await spaceRepository.get(body.spaceName);
            const id = current?.identities[body.spaceName];
            if (!id || !space?.participants[id]) socket.leave(`space:${body.spaceName}`);
            else socket.join(`space:${body.spaceName}`);
          }
        }
      }
      response.headers.set('X-Request-Id', requestId);
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
    return ApiResponse.json({ code: 'NOT_FOUND', requestId }, { status: 404 });
  } catch (error) {
    const status = error instanceof AccessError ? error.status : error instanceof ContractError || error instanceof SyntaxError ? 400 : error instanceof StorageUnavailableError ? 503 : 500;
    return ApiResponse.json({ code: error instanceof AccessError ? error.code : status === 400 ? 'INVALID_REQUEST' : status === 503 ? 'STORAGE_UNAVAILABLE' : 'INTERNAL_ERROR',
      message: status === 503 ? 'Storage unavailable' : 'Request failed', requestId }, { status });
  }
}

export async function dispatch(request: ApiRequest) {
  const response = await dispatchInternal(request);
  const requestId = response.headers.get('X-Request-Id') || randomUUID();
  response.headers.set('X-Request-Id', requestId);
  response.headers.set('X-API-Version', '1');
  response.headers.set('Cache-Control', 'no-store');
  if (request.nextUrl.pathname.includes('/api/v1/') && !response.ok) {
    const body = await response.clone().json().catch(() => ({}));
    return ApiResponse.json({ code: body.code || `HTTP_${response.status}`,
      message: body.message || body.error || 'Request failed', requestId },
      { status: response.status, headers: response.headers });
  }
  return response;
}
