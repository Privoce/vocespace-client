import { ApiRequest, ApiResponse } from './http';
import { requireNative } from './native-auth';
import { sessions, sessionToken } from './lib/server/sessions';
import { accountFlows } from './account/flow-store';
import { accountConfig } from './account/supabase';
import { POST } from './handlers/feedback';
import { AccessError } from './access';

/** Same feedback delivery/upload handler; Native credentials never reach legacy handlers directly. */
export async function nativeFeedbackEndpoint(request: ApiRequest) {
  if (request.method !== 'POST') throw new AccessError(405, 'METHOD_NOT_ALLOWED');
  const headers = new Headers(request.headers);
  // Multipart is allowed here, while the existing Native credential verifier stays JSON-only.
  headers.set('content-type', 'application/json');
  const { principal } = await requireNative(new ApiRequest(request.url, { headers }));
  if (!(await accountFlows.allow(`feedback:${principal.id}`, 10)))
    throw new AccessError(429, 'RATE_LIMITED');
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('application/json') && !contentType.startsWith('multipart/form-data'))
    throw new AccessError(415, 'INVALID_CONTENT_TYPE');
  return POST(request);
}

/** Only the server-verified platform UID can select an account; cached client profile is not trusted. */
export async function feedbackAccountEndpoint(request: ApiRequest) {
  if (request.method !== 'GET') throw new AccessError(405, 'METHOD_NOT_ALLOWED');
  if (
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin)
  )
    throw new AccessError(403, 'ORIGIN_DENIED');
  const principal = await sessions.read(sessionToken(request.headers));
  if (!principal || principal.client === 'native') throw new AccessError(401, 'SESSION_REQUIRED');
  const id = principal.platform?.id;
  if (!id || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id))
    return ApiResponse.json({ email: null });
  const config = accountConfig();
  if (!config.serviceKey) return ApiResponse.json({ email: null });
  const result = await fetch(`${config.url}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
    headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!result.ok) return ApiResponse.json({ email: null });
  const user = await result.json();
  return ApiResponse.json({
    email: user.id === id && typeof user.email === 'string' ? user.email : null,
  });
}
