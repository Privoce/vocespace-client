import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { ApiError, createAccountClient } from '@vocespace/client-sdk';
async function secureStorage<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch { throw new ApiError(503, 'ACCOUNT_STORAGE_UNAVAILABLE', 'Secure account storage unavailable'); }
}
/** Independent keychain namespace: Supabase account sessions are not RTC bearer sessions. */
export function configuredAccountClient() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (!configured) return undefined;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    return undefined;
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' && !(__DEV__ && url.protocol === 'http:'))
  )
    return undefined;
  url.pathname = url.pathname.replace(/\/+$/, '') + '/';
  const key = Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, url.toString()).then(
    (hash) => `vocespace.account.${hash}`,
  );
  return {
    api: createAccountClient({
      baseUrl: url.toString(),
      fetch: (input, init) => fetch(input, init),
    }),
    read: () => secureStorage(async () => SecureStore.getItemAsync(await key)),
    write: async (value: string) =>
      secureStorage(async () => SecureStore.setItemAsync(await key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      })),
    clear: () => secureStorage(async () => SecureStore.deleteItemAsync(await key)),
  };
}
