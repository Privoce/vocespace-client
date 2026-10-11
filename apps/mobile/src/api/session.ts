import { ApiError, createClient, createRealtimeClient } from '@vocespace/client-sdk';
import { parseNativeSession, type NativeSession } from '@vocespace/contracts';

export interface CredentialStore {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
}
/** Credentials are scoped to one API endpoint. No automatic retry of a business write. */
export function createNativeApi(baseUrl: string, store: CredentialStore, fetcher: typeof fetch) {
  let credential: NativeSession | undefined;
  let flight: Promise<void> | undefined;
  const sdk = createClient({
    baseUrl,
    fetch: fetcher,
    credentials: 'omit',
    getAccessToken: () => credential?.accessToken,
  });
  async function restore() {
    const raw = await store.read();
    try {
      credential = raw ? parseNativeSession(JSON.parse(raw)) : undefined;
    } catch {
      await store.clear();
      credential = undefined;
    }
    if (credential && credential.expiresAt <= Date.now()) {
      await store.clear();
      credential = undefined;
    }
    let fresh: NativeSession;
    try {
      fresh = await sdk.native.session();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || !credential) throw error;
      await store.clear();
      credential = undefined;
      fresh = await sdk.native.session();
    }
    credential = fresh;
    try {
      await store.write(JSON.stringify(fresh));
    } catch (error) {
      // Do not leave a working, unpersisted identity behind when keychain writes fail.
      await sdk.native.logout().catch(() => undefined);
      credential = undefined;
      throw error;
    }
  }
  return {
    sdk,
    createChatSocket(joinId: string) {
      const endpoint = new URL(baseUrl);
      return createRealtimeClient(endpoint.origin, {
        path: `${endpoint.pathname.replace(/\/+$/, '')}/socket.io`,
        transports: ['websocket'],
        // iOS WebSocket supplies its own Origin; identify the Bearer-only transport explicitly.
        extraHeaders: { 'X-Vocespace-Client': 'native' },
        timeout: 10_000,
        // Reconnect uses the existing credential, never silently changes the meeting identity.
        auth: (callback) => callback({ token: credential?.accessToken, joinId }),
      });
    },
    ensureSession() {
      flight ||= restore().finally(() => {
        flight = undefined;
      });
      return flight;
    },
  };
}
