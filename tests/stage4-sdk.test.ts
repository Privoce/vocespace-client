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

  it('scopes Native history to an owned join with Bearer JSON and no browser credentials', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ items: [] }));
    const client = createClient({ baseUrl: 'https://example.test/meet', fetch: fetcher,
      getAccessToken: () => 'test-token', credentials: 'include' });
    const controller = new AbortController();
    expect(await client.native.chatHistory('chat-join-12345678', controller.signal)).toEqual([]);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://example.test/meet/api/v1/native/chat/history');
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', signal: controller.signal,
      body: JSON.stringify({ joinId: 'chat-join-12345678' }) });
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-token');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
  });
  it('sends Native media acceptance through the scoped JSON Bearer endpoint and parses rights', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ sources: ['camera'], invitations: [] }));
    const client = createClient({ baseUrl: 'https://example.test/meet', fetch: fetcher, getAccessToken: () => 'test-token' });
    const controller = new AbortController();
    expect(await client.native.enableMedia('media-join-123456', 'camera', 'invite-1', controller.signal)).toEqual({ sources: ['camera'], invitations: [] });
    expect(fetcher.mock.calls[0][0]).toBe('https://example.test/meet/api/v1/native/media');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'PUT', credentials: 'omit', signal: controller.signal,
      body: JSON.stringify({ joinId: 'media-join-123456', device: 'camera', invitationId: 'invite-1' }) });
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('authorization')).toBe('Bearer test-token');
  });

});
