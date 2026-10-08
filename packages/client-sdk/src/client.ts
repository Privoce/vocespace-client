import { parseConnectionDetails, parseNativeSession, parseNativeJoin, type NativeJoinRequest, type ConnectionRequest } from '@vocespace/contracts';

export interface ClientOptions {
  /** Absolute service URL, optionally including a deployment path prefix. */
  baseUrl: string;
  fetch: typeof fetch;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  credentials?: RequestCredentials;
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string,
    message: string, public readonly requestId?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createClient(options: ClientOptions) {
  const base = new URL(options.baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password ||
      base.search || base.hash) throw new Error('Invalid API baseUrl');
  base.pathname = `${base.pathname.replace(/\/+$/, '')}/`;

  async function request(path: string, query: Record<string, string | undefined> = {},
    init: RequestInit = {}) {
    // Endpoints are fixed by SDK methods, never supplied by remote responses.
    const url = new URL(path, base);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    const token = await options.getAccessToken?.();
    // Fetch receives the original signal even if cancellation occurred during auth refresh.
    const headers = new Headers(init.headers);
    headers.set('X-Vocespace-Request', '1');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return options.fetch(url.toString(), { ...init, headers,
      credentials: init.credentials ?? options.credentials ?? 'same-origin' });
  }

  async function json<T>(response: Response, parse: (value: unknown) => T): Promise<T> {
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = body && typeof body === 'object' ? body as Record<string, unknown> : {};
      throw new ApiError(response.status, typeof error.code === 'string' ? error.code : 'HTTP_ERROR',
        'Request failed', typeof error.requestId === 'string' ? error.requestId : undefined);
    }
    return parse(body);
  }
  function nativeRequest(path: string, method: string, body: unknown, signal?: AbortSignal) {
    return request(path, {}, { method, body: JSON.stringify(body), signal,
      credentials: 'omit', headers: { 'Content-Type': 'application/json' } });
  }

  const connections = {
    /** Response compatibility for existing Web callers and platform redirects. */
    request(input: ConnectionRequest & { auth?: string }, signal?: AbortSignal) {
      return request('api/connection-details', {
        spaceName: input.spaceName, participantName: input.participantName,
        identity: input.identity || undefined, metadata: input.metadata,
        region: input.region || undefined, auth: input.auth || undefined,
      }, { signal });
    },
    async get(input: ConnectionRequest, signal?: AbortSignal) {
      const response = await connections.request(input, signal);
      if (!response.ok) {
        let body: Record<string, unknown> = {};
        try {
          const value: unknown = await response.json();
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            body = value as Record<string, unknown>;
          }
        } catch { /* Legacy routes may return plain text or proxy HTML. */ }
        throw new ApiError(response.status,
          typeof body.code === 'string' ? body.code : 'HTTP_ERROR',
          typeof body.message === 'string' ? body.message :
            typeof body.error === 'string' ? body.error : 'Connection request failed',
          typeof body.requestId === 'string' ? body.requestId : undefined);
      }
      return parseConnectionDetails(await response.json());
    },
  };

  return {
    connections,
    native: {
      async session(signal?: AbortSignal) {
        return json(await nativeRequest('api/v1/session/native', 'POST', {}, signal), parseNativeSession);
      },
      async logout() {
        return json(await nativeRequest('api/v1/session/native', 'DELETE', {}), () => undefined);
      },
      async prepare(input: NativeJoinRequest, signal?: AbortSignal) {
        return json(await nativeRequest('api/v1/native/conferences', 'POST', input, signal), parseNativeJoin);
      },
      async confirm(joinId: string, signal?: AbortSignal) {
        return json(await nativeRequest('api/v1/native/conferences', 'PUT', { joinId }, signal), (value) => {
          if (!value || typeof value !== 'object' || (value as { joined?: unknown }).joined !== true) {
            throw new Error('Invalid confirmation');
          }
        });
      },
      async leave(joinId: string) {
        return json(await nativeRequest('api/v1/native/conferences', 'DELETE', { joinId }), () => undefined);
      },
    },
    async transport(input: string | URL, init: RequestInit = {}) {
      const url = new URL(String(input), base);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error('API URL outside configured service');
      return request(url.pathname.slice(base.pathname.length), Object.fromEntries(url.searchParams), init);
    },
    session: {
      get: () => request('api/v1/session'),
      exchange: (code: string) => request('api/v1/session', {}, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }),
      logout: () => request('api/v1/session', {}, { method: 'DELETE' }),
    },
    chat: {
      history(spaceName: string, signal?: AbortSignal) {
        return request('api/space', { spaceName, chat: 'true', history: 'true' }, { signal });
      },
    },
    participants: {
      leave(spaceName: string, participantId: string, signal?: AbortSignal) {
        return request('api/space', { participant: 'delete', space: 'true' }, {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spaceName, participantId }), signal,
        });
      },
    },
  };
}
