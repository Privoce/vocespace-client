// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient, createRealtimeClient } from '@vocespace/client-sdk';

describe('platform-neutral SDK', () => {
  it('encodes special names and preserves deployment prefixes without browser globals', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('{}'));
    const client = createClient({ baseUrl: 'https://example.test/meet', fetch: fetcher });
    await client.connections.request({ spaceName: '中文 /?&', participantName: 'A+B', region: 'eu' });
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toBe('/meet/api/connection-details');
    expect(url.searchParams.get('spaceName')).toBe('中文 /?&');
    expect(url.searchParams.get('participantName')).toBe('A+B');
    expect(url.searchParams.get('region')).toBe('eu');
    expect(url.searchParams.has('identity')).toBe(false);
  });

  it('injects refreshed auth per request and leaves responses intact for legacy Web callers', async () => {
    const response = new Response('legacy body', { status: 403 });
    const fetcher = vi.fn<typeof fetch>(async () => response);
    let token = 'first';
    const client = createClient({ baseUrl: 'https://example.test', fetch: fetcher,
      getAccessToken: async () => token, credentials: 'include' });
    expect(await client.chat.history('r')).toBe(response);
    expect(fetcher.mock.calls[0][1]?.headers).toEqual(new Headers({ Authorization: 'Bearer first', 'X-Vocespace-Request': '1' }));
    token = 'second';
    await client.participants.leave('r', 'p');
    const [url, init] = fetcher.mock.calls[1];
    expect(new URL(String(url)).searchParams.get('participant')).toBe('delete');
    expect(init).toMatchObject({ method: 'DELETE', credentials: 'include', body: JSON.stringify({ spaceName: 'r', participantId: 'p' }) });
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer second');
  });

  it('passes cancellation through and does not retry writes or aborts', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      expect(init?.signal).toBe(controller.signal);
      throw new DOMException('cancelled', 'AbortError');
    });
    const client = createClient({ baseUrl: 'https://example.test', fetch: fetcher });
    controller.abort();
    await expect(client.connections.get({ spaceName: 'r', participantName: 'n' }, controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('validates typed success and maps structured or non-JSON failures', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createClient({ baseUrl: 'https://example.test', fetch: fetcher });
    const input = { spaceName: 'r', participantName: 'n' };
    const details = { serverUrl: 'wss://r', roomName: 'r', participantName: 'n', participantToken: 't' };
    fetcher.mockResolvedValueOnce(Response.json(details));
    expect(await client.connections.get(input)).toEqual(details);
    fetcher.mockResolvedValueOnce(Response.json({ code: 'DENIED', message: 'Denied', requestId: 'req-1' }, { status: 403 }));
    await expect(client.connections.get(input)).rejects.toMatchObject({ status: 403, code: 'DENIED', requestId: 'req-1' });
    fetcher.mockResolvedValueOnce(new Response('<html>proxy failed</html>', { status: 502 }));
    await expect(client.connections.get(input)).rejects.toBeInstanceOf(ApiError);
    fetcher.mockResolvedValueOnce(Response.json({ unexpected: true }));
    await expect(client.connections.get(input)).rejects.toThrow('Invalid connection details');
  });

  it('rejects unsupported protocols and credentials in service URLs', () => {
    for (const baseUrl of ['file:///tmp/data', 'https://user:pass@example.test', 'https://example.test?token=x']) {
      expect(() => createClient({ baseUrl, fetch })).toThrow('Invalid API baseUrl');
    }
  });

  it('creates independent, disconnected sockets with caller-provided handshake auth', () => {
    const auth = { token: 'test-session' };
    const first = createRealtimeClient('https://example.test', { auth, autoConnect: true });
    const second = createRealtimeClient('https://example.test');
    try {
      expect(first.connected).toBe(false);
      expect(first.io.opts.autoConnect).toBe(false);
      expect(first.auth).toEqual(auth);
      expect(first.io).not.toBe(second.io);
    } finally { first.disconnect(); second.disconnect(); }
  });
});
