// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  json: '',
  sendMail: vi.fn().mockResolvedValue({}),
  createTransport: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));
// Never read the developer's JSON, connect to Redis, or send real mail/requests.
vi.mock('fs', () => ({
  existsSync: () => true,
  readFileSync: () => mocks.json,
  writeFileSync: vi.fn(),
}));
vi.mock('fs/promises', () => {
  const io = {
    readFile: vi.fn().mockRejectedValue(new Error('no fixture file')),
    readdir: vi.fn().mockResolvedValue([]),
    writeFile: mocks.writeFile,
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
  return { ...io, default: io };
});
vi.mock('../../services/api/node_modules/nodemailer', () => ({
  default: { createTransport: mocks.createTransport },
}));
vi.mock('../../services/api/lib/server/sessions', () => ({ sessions: {}, sessionToken: vi.fn() }));
vi.mock('../../services/api/access', () => ({ membership: vi.fn() }));

import { DEFAULT_VOCESPACE_CONFIG, type VocespaceConfig } from '@vocespace/domain/config';
import { ApiRequest } from '../../services/api/http';

let conf: VocespaceConfig;
beforeEach(() => {
  conf = structuredClone(DEFAULT_VOCESPACE_CONFIG) as VocespaceConfig;
  conf.livekit = { url: 'wss://json.invalid', key: 'json-key', secret: 'json-secret' };
  conf.redis = { enabled: true, host: 'json-redis', port: 6380, db: 2, password: 'json-pass' };
  conf.hostToken = 'json-host-token';
  conf.smtp = { host: 'json-smtp', port: 587, secure: false, user: 'json-user', pass: 'json-pass', from: 'json@invalid.test' };
  conf.hyperbeam = { apiKey: 'json-key', apiBase: 'https://json.invalid', defaultStartUrl: 'https://start.invalid' };
  mocks.json = JSON.stringify(conf);
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const key of ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'HOST_TOKEN', 'REDIS_HOST', 'REDIS_PORT', 'SMTP_HOST', 'SMTP_PASS', 'HYPERBEAM_API_KEY', 'HYPERBEAM_API_BASE']) {
    vi.stubEnv(key, 'conflicting-env');
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const hyperbeamRequest = () => new ApiRequest('https://app.invalid/api/upload?tilePlayer=true', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ty: 'create_hyperbeam', spaceName: 'fixture', identity: 'fixture-user' }),
});

describe('business configuration comes from JSON', () => {
  it('reads LiveKit, Redis and host token from JSON; public Web config hides credentials', async () => {
    const { getConfig } = await import('../../services/api/lib/server/config');
    expect(getConfig().livekit).toEqual(conf.livekit);
    expect(getConfig().redis).toEqual(conf.redis);
    expect(getConfig().hostToken).toBe(conf.hostToken);
    const { GET } = await import('../../services/api/handlers/conf');
    const response = await GET(new ApiRequest('https://app.invalid/api/conf'));
    const body = await response.json();
    expect(body.livekit.url).toBe(conf.livekit.url);
    expect(body.livekit.key).toBe('');
    expect(body.livekit.secret).toBe('');
    expect(body.smtp).toBeUndefined();
  });

  it('sends mail using JSON and refuses a cleared SMTP password despite stale env', async () => {
    const { sendEmail } = await import('../../services/api/lib/email');
    expect(await sendEmail('fallback@invalid.test', 'to@invalid.test', 'fixture', 'fixture')).toBe(true);
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'json-smtp', auth: { user: 'json-user', pass: 'json-pass' },
    }));
    conf.smtp!.pass = '';
    mocks.json = JSON.stringify(conf);
    expect(await sendEmail('fallback@invalid.test', 'to@invalid.test', 'fixture', 'fixture')).toBe(false);
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
  });

  it('uses JSON Hyperbeam URL and credential', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ embed_url: 'https://embed.invalid', session_id: 'fixture' })));
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('../../services/api/handlers/upload');
    const response = await POST(hyperbeamRequest());
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith('https://json.invalid/v0/vm', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer json-key' }),
      body: JSON.stringify({ start_url: 'https://start.invalid' }),
    }));
  });

  it('does not use an old environment key after clearing Hyperbeam in JSON', async () => {
    conf.hyperbeam!.apiKey = '';
    mocks.json = JSON.stringify(conf);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('../../services/api/handlers/upload');
    const response = await POST(hyperbeamRequest());
    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain('hyperbeam.apiKey');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
