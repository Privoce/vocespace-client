import { timingSafeEqual } from 'node:crypto';
import { authorizeHostMutation } from '@vocespace/server-core';
import { getConfig, isConfigInitialized } from './config';

export function verifyHostToken(token: unknown): boolean {
  const expected = getConfig().hostToken;
  if (!expected || typeof token !== 'string' || !token) return false;
  const actualBytes = Buffer.from(token);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function authorizeConfigMutation(token: unknown, initialSetup: boolean) {
  authorizeHostMutation({ token, initialSetup, initialized: isConfigInitialized() }, verifyHostToken);
}
