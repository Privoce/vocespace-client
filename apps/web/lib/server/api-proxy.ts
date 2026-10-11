/** Next compatibility routes never execute backend business logic or start workers. */
export async function forwardApi(request: Request): Promise<Response> {
  const origin = process.env.VOCESPACE_API_URL || 'http://127.0.0.1:3001';
  const target = new URL(new URL(request.url).pathname + new URL(request.url).search, origin);
  const headers = new Headers(request.headers);
  headers.set('host', new URL(request.url).host);
  headers.set('x-forwarded-host', new URL(request.url).host);
  headers.set('x-forwarded-proto', new URL(request.url).protocol.slice(0, -1));
  try {
    return await fetch(target, {
      method: request.method, headers, redirect: 'manual',
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      signal: request.signal,
    });
  } catch {
    return Response.json({ code: 'BACKEND_UNAVAILABLE', message: 'Backend unavailable' }, { status: 503 });
  }
}
