import { ApiRequest } from './http';
import { getConfig } from './lib/server/config';
import { sessions, sessionCookie, sessionToken } from './lib/server/sessions';
import { AccessError } from './access';
import { nativePreviewEndpoint } from './native-preview';
import { accountFlows } from './account/flow-store';
import { POST as feedback } from './handlers/feedback';

export async function platformPreviewEndpoint(request: ApiRequest, kind: 'preview' | 'feedback') {
  if (!['POST', 'PUT', 'DELETE'].includes(request.method))
    throw new AccessError(405, 'METHOD_NOT_ALLOWED');
  const origin = getConfig().deployment.platform.publicOrigin;
  if (
    request.headers.get('origin') !== origin ||
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    request.headers.get('x-vocespace-request') !== '1'
  )
    throw new AccessError(403, 'ORIGIN_DENIED');
  if (kind === 'feedback' && request.method !== 'POST')
    throw new AccessError(405, 'METHOD_NOT_ALLOWED');
  // Browser identity is an opaque HttpOnly cookie, never a Native Bearer token.
  const headers = new Headers(request.headers);
  headers.delete('authorization');
  if (!(await accountFlows.allow(`platform-${kind}:global`, kind === 'preview' ? 1200 : 40)))
    throw new AccessError(429, 'RATE_LIMITED');
  let token = sessionToken(headers);
  let principal = await sessions.read(token);
  let created = false;
  if (!token || !principal) {
    const fresh = await sessions.create();
    token = fresh.token;
    principal = fresh.principal;
    created = true;
  }
  if (principal.client === 'native') throw new AccessError(403, 'BROWSER_SESSION_REQUIRED');
  if (
    !(await accountFlows.allow(`platform-${kind}:${principal.id}`, kind === 'preview' ? 120 : 10))
  )
    throw new AccessError(429, 'RATE_LIMITED');
  let result;
  try {
    result =
      kind === 'preview'
        ? await nativePreviewEndpoint(request, { token, principal })
        : await feedback(request);
  } catch (error) {
    if (created) await sessions.revoke(token);
    throw error;
  }
  if (created) result.headers.set('Set-Cookie', sessionCookie(token, origin));
  return result;
}
