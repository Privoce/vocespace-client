import { getConfig } from './lib/server/config';
import { moderationEndpoint } from './moderation';
import { nativeFeedbackEndpoint, feedbackAccountEndpoint } from './native-feedback';
import { accountEndpoint } from './account/endpoint';
import { nativeRecordsEndpoint } from './native-records';
import { nativePreviewEndpoint, previewMediaEndpoint, previewRendererEndpoint } from './native-preview';
import { nativeRoomsEndpoint, nativeSpacesEndpoint } from './native-directory';
import { nativeSettingsEndpoint } from './native-settings';
import { nativeSessionEndpoint } from './native-auth';
import { nativeConferenceEndpoint } from './native-conference';
import { nativeMediaEndpoint } from './native-media';
import { nativeChatEndpoint } from './native-chat';
import { ContractError } from '@vocespace/contracts';
import { spaceRepository } from './lib/server/space-repository';
import { sessions, sessionToken } from './lib/server/sessions';
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
    const prefix = getConfig().deployment.basePath;
    if (prefix && pathname.startsWith(prefix + '/')) pathname = pathname.slice(prefix.length);
    pathname = pathname.replace(/^\/uploads\//, '/api/files/');
    pathname = pathname.replace(/^\/api\/v1\//, '/api/');
    const accountAction = pathname.match(/^\/api\/account\/([a-z-]+)$/);
    if (accountAction) return await accountEndpoint(request, accountAction[1]);
    if (pathname === '/api/native/moderation') return await moderationEndpoint(request, true);
    if (pathname === '/api/moderation') return await moderationEndpoint(request, false);
    if (pathname === '/api/native/feedback') return await nativeFeedbackEndpoint(request);
    if (pathname === '/api/feedback/account') return await feedbackAccountEndpoint(request);
    if (pathname === '/healthz') return ApiResponse.json({ status: 'ok', apiVersion: 1 });
    if (pathname === '/api/session/native') return await nativeSessionEndpoint(request);
    if (pathname === '/api/native/conferences') return await nativeConferenceEndpoint(request);
    if (pathname === '/api/native/preview') return await nativePreviewEndpoint(request);
    const previewMedia = pathname.match(/^\/api\/preview\/media\/([a-f0-9]{64})\/([^/]+)$/);
    if (previewMedia) return await previewMediaEndpoint(request, previewMedia[1], previewMedia[2]);
    const renderer = pathname.match(/^\/api\/preview\/(render|details|script)$/);
    if (renderer) return await previewRendererEndpoint(request, renderer[1] as 'render' | 'details' | 'script');
    if (pathname === '/api/native/spaces') return await nativeSpacesEndpoint(request);
    if (pathname === '/api/native/rooms') return await nativeRoomsEndpoint(request);
    if (pathname === '/api/native/records') return await nativeRecordsEndpoint(request);
    if (pathname === '/api/native/settings') return await nativeSettingsEndpoint(request);
    if (pathname === '/api/native/media') return await nativeMediaEndpoint(request);
    if (pathname === '/api/native/chat/history') return await nativeChatEndpoint(request);
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
    if (status >= 500) {
      // Correlate Native's error screen without logging credentials, payloads or stored data.
      console.error('API request failed', {
        requestId,
        method: request.method,
        kind: error instanceof Error ? error.name : 'UnknownError',
        status,
      });
    }
    return ApiResponse.json({ code: error instanceof AccessError ? error.code : status === 400 ? 'INVALID_REQUEST' : status === 503 ? 'STORAGE_UNAVAILABLE' : 'INTERNAL_ERROR',
      message: status === 503 ? 'Storage unavailable' : 'Request failed', requestId }, { status, headers: { 'X-Request-Id': requestId } });
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
