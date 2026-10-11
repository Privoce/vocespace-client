// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  initialized: true,
  write: vi.fn(() => ({ success: true })),
  config: {
    hostToken: 'test-host-token',
    livekit: { url: 'wss://rtc.example.test', key: 'private-api-key', secret: 'private-api-secret', turn: [] },
    s3: { accessKey: 'private-s3-key', secretKey: 'private-s3-secret', bucket: 'recordings', region: 'test' },
    serverUrl: 'https://web.example.test',
    create_space: 'all' as const, license: '', ai: { apiKey: 'private-ai-key' },
  },
}));
vi.mock('../services/api/lib/server/config', () => ({
  getConfig: () => structuredClone(state.config),
  isConfigInitialized: () => state.initialized,
  setStoredConf: vi.fn(), setConfigEnv: state.write, setConfigLicense: state.write,
  setConfigRoomLicense: state.write, setConfigSMTP: state.write, setConfigHyperbeam: state.write,
  setFullConfig: state.write, writeBackConfig: state.write,
}));
vi.mock('../services/api/lib/s3-clean', () => ({ addCleanTask: vi.fn() }));
import { GET, POST } from '@/services/api/handlers/conf';
import { GET as recordGET } from '@/services/api/handlers/record';

function request(query: string, body: unknown, token?: string) {
  return new NextRequest(`https://web.example.test/api/conf?${query}`, {
    method: 'POST', body: JSON.stringify(body), headers: {
      'Content-Type': 'application/json', ...(token ? { 'x-vocespace-host-token': token } : {}),
    },
  });
}

beforeEach(() => { state.initialized = true; state.write.mockClear(); });

describe('configuration authorization', () => {
  it.each(['setup=true', 'ai=true', 'create_space=true', 'smtp=true', 'hyperbeam=true'])(
    'rejects untrusted %s writes before touching configuration', async (query) => {
      const response = await POST(request(query, { hostToken: 'wrong' }));
      expect(response.status).toBe(403);
      expect(state.write).not.toHaveBeenCalled();
    },
  );

  it('allows first setup but requires the old credential to replace an initialized configuration', async () => {
    state.initialized = false;
    expect((await POST(request('setup=true', { ...state.config, hostToken: 'new-token' }))).status).toBe(200);
    state.initialized = true;
    expect((await POST(request('setup=true', { ...state.config, hostToken: 'new-token' }))).status).toBe(403);
    expect((await POST(request('setup=true', { ...state.config, hostToken: 'new-token' }, 'test-host-token'))).status).toBe(200);
    expect(state.write).toHaveBeenCalledTimes(2);
  });

  it('allows authorized AI and creation-policy changes through the existing body contract', async () => {
    expect((await POST(request('ai=true', { hostToken: 'test-host-token', aiConf: { enabled: true } }))).status).toBe(200);
    expect((await POST(request('create_space=true', { hostToken: 'test-host-token', createStrategy: 'white', whiteList: ['alice'] }))).status).toBe(200);
    expect(state.write).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed JSON without writing', async () => {
    const req = new NextRequest('https://web.example.test/api/conf?setup=true', {
      method: 'POST', body: '{invalid',
    });
    expect((await POST(req)).status).toBe(400);
    expect(state.write).not.toHaveBeenCalled();
  });

  it('uses the same header credential for SMTP and Hyperbeam writes', async () => {
    expect((await POST(request('smtp=true', { smtpConf: { host: 'smtp.example.test' } }, 'test-host-token'))).status).toBe(200);
    expect((await POST(request('hyperbeam=true', { hyperbeamConf: { apiKey: 'test' } }, 'test-host-token'))).status).toBe(200);
    expect(state.write).toHaveBeenCalledTimes(2);
  });

  it('does not treat non-string or empty credentials as a verified administrator', async () => {
    for (const hostToken of ['', 42, null]) {
      const response = await POST(request('check=true', { hostToken }));
      expect(await response.json()).toEqual({ success: false });
    }
  });
});

describe('public capability responses', () => {
  it('does not return LiveKit management or AI secrets to public callers', async () => {
    for (const token of [undefined, 'wrong']) {
      const response = await GET(new NextRequest('https://web.example.test/api/conf', {
        headers: token ? { 'x-vocespace-host-token': token } : {},
      }));
      const body = await response.json();
      expect(body.livekit).toMatchObject({ url: 'wss://rtc.example.test', key: '', secret: '' });
      expect(body).not.toHaveProperty('ai');
      expect(JSON.stringify(body)).not.toContain('private-');
    }
  });

  it('preserves authenticated settings reads with header and legacy query credentials', async () => {
    const requestOptions = [
      new NextRequest('https://web.example.test/api/conf', { headers: { 'x-vocespace-host-token': 'test-host-token' } }),
      new NextRequest('https://web.example.test/api/conf?hostToken=test-host-token'),
    ];
    for (const req of requestOptions) {
      const body = await (await GET(req)).json();
      expect(body.livekit.secret).toBe('private-api-secret');
      expect(body.ai.apiKey).toBe('private-ai-key');
    }
  });

  it('reports recording availability without storage credentials', async () => {
    const response = await recordGET(new NextRequest('https://web.example.test/api/record?env=true'));
    const body = await response.json();
    expect(body).toEqual({ configured: true, s3_bucket: 'recordings', s3_region: 'test', server_host: 'https://web.example.test' });
    expect(JSON.stringify(body)).not.toContain('private-');
  });
});
