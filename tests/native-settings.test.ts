// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import {
  parseNativeSettingsSnapshot,
  settingsPermissionKeys,
  settingsRoles,
} from '@vocespace/contracts';
import { ApiRequest } from '../services/api/http';
const mocks = vi.hoisted(() => ({ requireNative: vi.fn(), member: vi.fn(), get: vi.fn() }));
vi.mock('../services/api/native-auth', () => ({ requireNative: mocks.requireNative }));
vi.mock('../services/api/lib/server/native-chat', () => ({ requireNativeChatMember: mocks.member }));
vi.mock('../services/api/lib/server/space-repository', () => ({ spaceRepository: { get: mocks.get } }));
import { nativeSettingsEndpoint } from '../services/api/native-settings';
import { createClient } from '@vocespace/client-sdk';
const permissions = Object.fromEntries(
  settingsRoles.map((role) => [
    role,
    Object.fromEntries(settingsPermissionKeys.map((key) => [key, role === 'owner'])),
  ]),
);
const participant = {
  avoList: [
    { name: 'Ada', variant: 1, hue: 193, style: 'blob', energy: 0.6, isUsed: true, enabled: true },
  ],
  virtual: { role: 'None', bg: 'v_bg1.png', enabled: false },
  name: 'Ada',
  status: 'settings.general.status.online',
  volume: 100,
  blur: 0,
  screenBlur: 0,
  openPromptSound: true,
  openShareAudio: true,
  appAuth: 'read',
  audioProcessing: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
};
const snapshot = { ...participant, permissions };
const request = (method = 'POST', body: unknown = { joinId: 'test-join-123456' }) =>
  new ApiRequest('https://api.test/api/v1/native/settings', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireNative.mockResolvedValue({
    principal: { id: 'native-session' },
    token: 'fake-token',
  });
  mocks.member.mockResolvedValue({ spaceName: 'room', identity: 'native-identity' });
  mocks.get.mockResolvedValue({
    auth: permissions,
    participants: { 'native-identity': { ...participant, secret: 'not-public' } },
    ai: { key: 'not-public' },
    license: 'not-public',
  });
});
it('projects only the confirmed participant preferences and permission matrix', async () => {
  const response = await nativeSettingsEndpoint(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(snapshot);
  expect(mocks.member).toHaveBeenCalledTimes(2);
});
it('does not trust a caller-supplied room, identity or management role', async () => {
  await nativeSettingsEndpoint(
    request('POST', {
      joinId: 'test-join-123456',
      spaceName: 'private',
      identity: 'owner',
      role: 'owner',
    }),
  );
  expect(mocks.get).toHaveBeenCalledWith('room');
  mocks.member.mockRejectedValueOnce(new Error('membership denied'));
  await expect(nativeSettingsEndpoint(request())).rejects.toThrow('membership denied');
});
it('rechecks revocation/session state after reading and denies stale results', async () => {
  mocks.member
    .mockResolvedValueOnce({ spaceName: 'room', identity: 'native-identity' })
    .mockRejectedValueOnce(new Error('revoked'));
  await expect(nativeSettingsEndpoint(request())).rejects.toThrow('revoked');
});
it('rejects malformed writes, invalid joins and incomplete settings payloads', async () => {
  await expect(nativeSettingsEndpoint(request('PUT'))).rejects.toThrow('INVALID_NATIVE_SETTINGS');
  expect(mocks.get).not.toHaveBeenCalled();
  await expect(nativeSettingsEndpoint(request('POST', { joinId: 'x' }))).rejects.toThrow();
  for (const patch of [
    { volume: NaN },
    { volume: 101 },
    { blur: -1 },
    { permissions: {} },
    { openPromptSound: 'true' },
    { audioProcessing: null },
    { appAuth: 'owner' },
    { avoList: [{ apiKey: 'unexpected' }] },
    { virtual: null },
  ])
    expect(() => parseNativeSettingsSnapshot({ ...snapshot, ...patch })).toThrow();
  expect(
    parseNativeSettingsSnapshot({
      ...snapshot,
      token: 'hidden',
      avoList: snapshot.avoList.map((item) => ({ ...item, apiKey: 'hidden' })),
      virtual: { ...snapshot.virtual, token: 'hidden' },
    }),
  ).toEqual(snapshot);
});
it('binds the SDK to the deployment prefix, Bearer credential, abort signal and a validated response', async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify(snapshot), { headers: { 'content-type': 'application/json' } }),
  );
  const sdk = createClient({
    baseUrl: 'https://api.test/prefix/',
    fetch: fetcher as unknown as typeof fetch,
    getAccessToken: () => 'test-native-token',
    credentials: 'omit',
  });
  const signal = new AbortController().signal;
  expect(await sdk.native.settings('test-join-123456', signal)).toEqual(snapshot);
  const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
  expect(String(url)).toBe('https://api.test/prefix/api/v1/native/settings');
  expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-native-token');
  expect(init.signal).toBe(signal);
  expect(init.credentials).toBe('omit');
  expect(JSON.parse(String(init.body))).toEqual({ joinId: 'test-join-123456' });
});
