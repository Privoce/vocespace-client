import { ApiRequest, ApiResponse } from '../http';
import { sessions, sessionToken } from '../lib/server/sessions';
import { platformDataRequest } from '../lib/server/platform-data';
export async function proxyPlatform(request: ApiRequest, suffix: string) {
  const principal = await sessions.read(sessionToken(request.headers));
  if (!principal?.platform) return ApiResponse.json({ code: 'PLATFORM_SESSION_REQUIRED' }, { status: 403 });
  if (!['', '/todos', '/ai', '/user'].includes(suffix)) return new ApiResponse(null, { status: 404 });
  return platformDataRequest(principal.platform.id, suffix.slice(1), request.method, request.nextUrl.searchParams,
    ['GET', 'HEAD'].includes(request.method) ? {} : await request.json());
}
