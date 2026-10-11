// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_SPACE_INFO, DEFAULT_PARTICIPANT_SETTINGS } from '@vocespace/domain/space';
import { ApiRequest } from '../services/api/http';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  member: vi.fn(),
  get: vi.fn(),
  config: vi.fn(),
  send: vi.fn(),
}));
vi.mock('../services/api/native-auth', () => ({ requireNative: mocks.auth }));
vi.mock('../services/api/lib/server/native-chat', () => ({
  requireNativeChatMember: mocks.member,
}));
vi.mock('../services/api/lib/server/space-repository', () => ({
  spaceRepository: { get: mocks.get },
}));
vi.mock('../services/api/lib/server/config', () => ({ getConfig: mocks.config }));
vi.mock('@aws-sdk/client-s3', () => {
  class Command {
    constructor(public input: unknown) {}
  }
  return {
    S3Client: class {
      send = mocks.send;
      destroy() {}
    },
    ListObjectsV2Command: Command,
    GetObjectCommand: Command,
    DeleteObjectCommand: Command,
  };
});
import { nativeRecordsEndpoint } from '../services/api/native-records';
const request = (method = 'POST', key?: string) =>
  new ApiRequest('https://api.test/api/v1/native/records', {
    method,
    body: JSON.stringify({ joinId: 'records-test-123456', ...(key ? { key } : {}) }),
    headers: { 'content-type': 'application/json' },
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ principal: { id: 'session' } });
  mocks.member.mockResolvedValue({ spaceName: 'demo', identity: 'owner' });
  mocks.get.mockResolvedValue({
    ...DEFAULT_SPACE_INFO(1, true),
    ownerId: 'owner',
    participants: { owner: { ...DEFAULT_PARTICIPANT_SETTINGS, name: 'Ada' } },
  });
  mocks.config.mockReturnValue({
    s3: {
      accessKey: 'fixture',
      secretKey: 'fixture-secret',
      bucket: 'fixture-bucket',
      region: 'us-east-1',
    },
  });
});
it('lists only this Space recording files and projects no storage credentials', async () => {
  mocks.send.mockResolvedValue({
    Contents: [
      { Key: 'demo/one.mp4', Size: 10, LastModified: new Date(1000) },
      { Key: 'demo-2/other.mp4', Size: 20 },
      { Key: 'demo/private/hidden.mp4' },
      { Key: 'demo/config.json' },
    ],
  });
  const result = await nativeRecordsEndpoint(request());
  expect(await result.json()).toEqual({
    configured: true,
    canDelete: true,
    records: [{ key: 'demo/one.mp4', size: 10, lastModified: 1000 }],
  });
  expect(mocks.send.mock.calls[0][0].input.Prefix).toBe('demo/');
});
it('reports missing storage without attempting an external request', async () => {
  mocks.config.mockReturnValue({ s3: {} });
  expect(await (await nativeRecordsEndpoint(request())).json()).toEqual({
    configured: false,
    canDelete: true,
    records: [],
  });
  expect(mocks.send).not.toHaveBeenCalled();
});
it('rejects sibling Space and nested file operations', async () => {
  for (const key of ['demo-2/one.mp4', 'demo/private/one.mp4', 'demo/../one.mp4', 'demo/data.json'])
    await expect(nativeRecordsEndpoint(request('DELETE', key))).rejects.toThrow(
      'INVALID_RECORDING_KEY',
    );
  expect(mocks.send).not.toHaveBeenCalled();
});
it('rechecks membership before releasing recorded data', async () => {
  mocks.send.mockResolvedValue({ Contents: [{ Key: 'demo/one.mp4' }] });
  mocks.member
    .mockResolvedValueOnce({ spaceName: 'demo', identity: 'owner' })
    .mockRejectedValueOnce(new Error('revoked'));
  await expect(nativeRecordsEndpoint(request())).rejects.toThrow();
});
