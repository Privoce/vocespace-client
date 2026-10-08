// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { parseConnectionDetails, parseConnectionRequest } from '@vocespace/contracts';
import { generateBasicIdentity, matchesCreateWhitelist } from '@vocespace/domain';
import { createLegacyConnectionService, type LegacyConnectionConfig } from '@vocespace/server-core';

function setup(config: Partial<LegacyConnectionConfig> = {}, exists = false) {
  const issueToken = vi.fn(async (_input: import('@vocespace/server-core').ParticipantTokenInput) => 'rtc-test-token');
  const spaceExists = vi.fn(async () => exists);
  const service = createLegacyConnectionService({
    getConfig: () => ({ serverUrl: 'wss://rtc.example.test', createMode: 'all', ...config }),
    spaceExists, issueToken,
  });
  return { service, issueToken, spaceExists };
}

describe('legacy connection extraction', () => {
  it('validates unknown inputs before any repository or token operation', async () => {
    const { service, spaceExists, issueToken } = setup();
    await expect(service.connect({ spaceName: 'room', participantName: 42 })).rejects.toThrow('participantName');
    expect(spaceExists).not.toHaveBeenCalled();
    expect(issueToken).not.toHaveBeenCalled();
    expect(() => parseConnectionRequest(null)).toThrow();
    expect(() => parseConnectionRequest({ spaceName: 'r', participantName: 'n', metadata: {} })).toThrow();
  });

  it('keeps the wire response, fallback identity and metadata without leaking config', async () => {
    const { service, issueToken } = setup();
    expect(await service.connect({ spaceName: '房间', participantName: 'Alice', metadata: 'profile' }))
      .toEqual({ serverUrl: 'wss://rtc.example.test', roomName: '房间', participantName: 'Alice',
        participantToken: 'rtc-test-token' });
    expect(issueToken).toHaveBeenCalledWith({ identity: 'Alice__房间', name: 'Alice',
      roomName: '房间', metadata: 'profile' });
    expect(generateBasicIdentity('Alice', '房间')).toBe('Alice__房间');
  });

  it('denies creation before issuing a token, but does not apply creation policy to existing spaces', async () => {
    const denied = setup({ createMode: 'white', whiteList: ['Bob'] });
    await expect(denied.service.connect({ spaceName: 'room', participantName: 'Alice' }))
      .rejects.toThrow('white list');
    expect(denied.issueToken).not.toHaveBeenCalled();
    const existing = setup({ createMode: 'white', whiteList: [] }, true);
    await expect(existing.service.connect({ spaceName: 'room', participantName: 'Alice' })).resolves.toBeDefined();
  });

  it('preserves legacy white_platform behavior explicitly, without calling it trusted authentication', async () => {
    const { service, issueToken } = setup({ createMode: 'white_platform' });
    await expect(service.connect({ spaceName: 'r', participantName: 'n' })).rejects.toThrow();
    await service.connect({ spaceName: 'r', participantName: 'n', identity: 'legacy-id' });
    expect(issueToken).toHaveBeenCalledOnce();
    expect(issueToken.mock.calls[0][0]).toMatchObject({ identity: 'legacy-id' });
  });

  it('propagates repository/token failures and never returns a false successful connection', async () => {
    const service = createLegacyConnectionService({
      getConfig: () => ({ serverUrl: '', createMode: 'all' }),
      spaceExists: async () => true, issueToken: vi.fn(),
    });
    await expect(service.connect({ spaceName: 'r', participantName: 'n' })).rejects.toThrow('not configured');
    const failing = setup();
    failing.issueToken.mockRejectedValueOnce(new Error('issuer unavailable'));
    await expect(failing.service.connect({ spaceName: 'r', participantName: 'n' })).rejects.toThrow('issuer unavailable');
    failing.spaceExists.mockRejectedValueOnce(new Error('repository unavailable'));
    await expect(failing.service.connect({ spaceName: 'r', participantName: 'n' })).rejects.toThrow('repository unavailable');
  });
});

describe('wire and identity compatibility', () => {
  it.each([
    ['Alice', undefined, [' alice '], true],
    ['name', 'ALICE__room', ['user-alice'], true],
    ['name', 'malice__room', ['user-alice'], false],
    ['name', 'user-alice', ['user-alice'], true],
    ['', '', ['*'], false],
    ['name', undefined, ['*'], true],
    ['name', undefined, [], false],
  ] as const)('matches creation whitelist for %s / %s', (name, id, entries, result) => {
    expect(matchesCreateWhitelist(name, id, [...entries])).toBe(result);
  });

  it('rejects malformed server responses and copies only the public DTO', () => {
    expect(() => parseConnectionDetails({ participantToken: 123 })).toThrow();
    expect(parseConnectionDetails({ serverUrl: 'wss://r', roomName: 'r', participantName: 'n',
      participantToken: 'token', secret: 'must-not-copy' })).not.toHaveProperty('secret');
  });
});
