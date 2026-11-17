// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { HostAuthorizationError } from '@vocespace/server-core';
const saved = vi.hoisted(() => ({ write: vi.fn(() => ({ success: true })) }));
import { DEFAULT_VOCESPACE_CONFIG } from '@vocespace/domain/config';
vi.mock('../../services/api/lib/server/config', () => ({
  getConfig: () => ({ ...DEFAULT_VOCESPACE_CONFIG, hostToken: 'fixture-admin', ai: { enabled: true, apiKey: 'fixture-ai-key', apiUrl: 'https://ai.invalid/v1', model: 'fixture-model', maxTokens: 120000 }, smtp: {
    host: 'smtp.invalid', port: 587, secure: false,
    user: 'fixture-user', from: 'sender@example.invalid', pass: 'fixture-secret',
  } }),
  isConfigInitialized: () => true,
  setStoredConf: vi.fn(),
  writeBackConfig: saved.write,
}));
vi.mock('../../services/api/lib/server/host-authorization', () => ({
  authorizeConfigMutation: (token: unknown) => { if (token !== 'fixture-admin') throw new HostAuthorizationError(); },
  verifyHostToken: (token: unknown) => token === 'fixture-admin',
}));
import { GET, POST } from '../../services/api/handlers/conf';
import { ApiRequest } from '../../services/api/http';
it('returns SMTP fields only to the authenticated administrator', async () => {
  const publicResponse = await GET(new ApiRequest('https://app.invalid/api/conf'));
  expect((await publicResponse.json()).smtp).toBeUndefined();
  const adminResponse = await GET(new ApiRequest('https://app.invalid/api/conf', {
    headers: { 'x-vocespace-host-token': 'fixture-admin' },
  }));
  expect((await adminResponse.json()).smtp).toMatchObject({ user: 'fixture-user', from: 'sender@example.invalid' });
});
it('rejects an invalid explicit credential instead of silently returning public defaults', async () => {
  const response = await GET(new ApiRequest('https://app.invalid/api/conf', {
    headers: { 'x-vocespace-host-token': 'revoked-fixture' },
  }));
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ code: 'ADMIN_REQUIRED', message: 'Request failed' });
});

it('protects AI reads and writes, persists the AI section and rejects malformed settings', async () => {
  expect((await (await GET(new ApiRequest('https://app.invalid/api/conf'))).json()).ai).toBeUndefined();
  const admin = await GET(new ApiRequest('https://app.invalid/api/conf', { headers: { 'x-vocespace-host-token': 'fixture-admin' } }));
  expect((await admin.json()).ai.apiKey).toBe('fixture-ai-key');
  const aiConf = { enabled: true, apiKey: 'next-key', apiUrl: 'https://next.invalid/v1', model: 'next-model', maxTokens: 120000 };
  const update = (token: string, body: unknown) => POST(new ApiRequest('https://app.invalid/api/conf?ai=true', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-vocespace-host-token': token }, body: JSON.stringify({ aiConf: body }),
  }));
  expect((await update('wrong', aiConf)).status).toBe(403);
  expect(saved.write).not.toHaveBeenCalled();
  for (const invalid of [null, {}, { ...aiConf, maxTokens: 1.5 }, { ...aiConf, maxTokens: 0 }, { ...aiConf, apiUrl: 'javascript:invalid' }]) {
    expect((await update('fixture-admin', invalid)).status).toBe(400);
  }
  expect(saved.write).not.toHaveBeenCalled();
  expect((await update('fixture-admin', aiConf)).status).toBe(200);
  expect(saved.write).toHaveBeenCalledWith(expect.objectContaining({ ai: aiConf, hostToken: 'fixture-admin', smtp: expect.objectContaining({ user: 'fixture-user' }) }));
});
