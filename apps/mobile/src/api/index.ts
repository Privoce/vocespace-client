import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createNativeApi } from './session';

export function createConfiguredApi() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (!configured) return undefined;
  let endpoint: URL;
  try {
    endpoint = new URL(configured);
  } catch {
    return undefined;
  }
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    (endpoint.protocol !== 'https:' && !(__DEV__ && endpoint.protocol === 'http:'))
  )
    return undefined;
  endpoint.pathname = endpoint.pathname.replace(/\/+$/, '') + '/';
  const key = Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    endpoint.toString(),
  ).then((hash) => `vocespace.session.${hash}`);
  return createNativeApi(
    endpoint.toString(),
    {
      read: async () => SecureStore.getItemAsync(await key),
      write: async (value) =>
        SecureStore.setItemAsync(await key, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      clear: async () => SecureStore.deleteItemAsync(await key),
    },
    (input, init) => fetch(input, init),
  );
}
