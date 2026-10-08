import { ApiRequest, ApiResponse } from '../http';
import { sessions, sessionToken } from '@/lib/server/sessions';

export async function proxyPlatform(request: ApiRequest, suffix: string) {
  const principal = await sessions.read(sessionToken(request.headers));
  if (!principal?.platform) return ApiResponse.json({ code: 'PLATFORM_SESSION_REQUIRED' }, { status: 403 });
  if (!['', '/todos', '/ai', '/user'].includes(suffix)) return new ApiResponse(null, { status: 404 });
  const url = new URL(`https://home.vocespace.com/api${suffix || '/vocespace'}`);
  for (const [key, value] of request.nextUrl.searchParams) url.searchParams.set(key, value);
  url.searchParams.set('uid', principal.platform.id);
  url.searchParams.set('id', principal.platform.id);
  let body;
  if (!['GET','HEAD'].includes(request.method)) {
    const input = await request.json();
    input.id = principal.platform.id;
    if (input.todo) input.todo.id = principal.platform.id;
    body = JSON.stringify(input);
  }
  const response = await fetch(url, { method: request.method, body,
    headers: { 'Content-Type': 'application/json' }, signal: request.signal, redirect: 'error' });
  return new ApiResponse(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } });
}
