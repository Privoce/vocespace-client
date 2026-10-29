import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const store = vi.hoisted(() => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn() }));
vi.mock('expo-secure-store', () => ({ ...store, WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6 }));
vi.mock('expo-crypto', () => ({
  digestStringAsync: async () => 'test-hash', CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
vi.mock('../src/config', () => ({ mobileConfig: { mobile: { apiUrl: 'http://localhost:3001' } } }));
import { configuredAccountClient } from '../src/account/client';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('__DEV__', true);
});
it('identifies keychain failures separately from account service failures without exposing native details', async () => {
  const error = new Error('A required entitlement is missing');
  store.getItemAsync.mockRejectedValue(error);
  store.setItemAsync.mockRejectedValue(error);
  store.deleteItemAsync.mockRejectedValue(error);
  const client = configuredAccountClient()!;
  for (const work of [() => client.read(), () => client.write('session'), () => client.clear()]) {
    await expect(work()).rejects.toMatchObject({ code: 'ACCOUNT_STORAGE_UNAVAILABLE' });
  }
});
it('stores account sessions with the device-only unlocked protection', async () => {
  const client = configuredAccountClient()!;
  await client.write('session');
  expect(store.setItemAsync).toHaveBeenCalledWith('vocespace.account.test-hash', 'session', { keychainAccessible: 6 });
});
