// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readConfiguration, publicConfiguration, normalizeConfiguration, setConfigPath } from '@vocespace/config-node';
import { DEFAULT_VOCESPACE_CONFIG, clearReadableConf } from '@vocespace/domain/config';
let directory: string;
let file: string;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vocespace-json-test-'));
  file = path.join(directory, 'vocespace.conf.json');
});
afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); vi.unstubAllEnvs(); });

it('fills old JSON defaults without mutating or logging it; rejects wrong field types', () => {
  fs.writeFileSync(file, JSON.stringify({ livekit: { key: 'secret-sentinel' } }));
  const original = fs.readFileSync(file, 'utf8');
  const conf = readConfiguration({ file });
  expect(conf.preview.enabled).toBe(false);
  expect(conf.deployment.api.port).toBe(3001);
  expect(fs.readFileSync(file, 'utf8')).toBe(original);
  expect(() => normalizeConfiguration({ billing: { stripe: { enabled: 'false' } } })).toThrow(/billing.stripe.enabled/);
  expect(() => normalizeConfiguration({ deployment: { api: { port: 0 } } })).toThrow(/port/);
  fs.writeFileSync(file, '{invalid secret-sentinel');
  expect(() => readConfiguration({ file })).toThrow(/Cannot read configuration JSON/);
  try { readConfiguration({ file }); } catch (e) { expect(String(e)).not.toContain('secret-sentinel'); }
});

it('Supabase, public URL and billing configuration ignore conflicting process env', async () => {
  fs.writeFileSync(file, JSON.stringify({ ...DEFAULT_VOCESPACE_CONFIG,
    account: { supabase: { url: 'https://supabase.invalid', publishableKey: 'json-public', serviceRoleKey: 'json-private' } },
    billing: { stripe: { enabled: false } },
  }));
  setConfigPath(file);
  vi.stubEnv('SUPABASE_URL', 'https://env.invalid');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'env-public');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'env-private');
  vi.stubEnv('WEBHOOK', 'true');
  const { accountConfig } = await import('../../services/api/account/supabase');
  expect(accountConfig()).toEqual({ url: 'https://supabase.invalid', key: 'json-public', serviceKey: 'json-private' });
  const { GET } = await import('../../services/api/handlers/webhook-status');
  expect(await (await GET()).json()).toEqual({ webhook: false });
});

it('public projections omit secrets, including unknown nested fields', () => {
  const conf = normalizeConfiguration({ ...DEFAULT_VOCESPACE_CONFIG,
    account: { supabase: { serviceRoleKey: 'secret-account' } },
    billing: { licenseSecret: 'secret-license', stripe: { secretKey: 'secret-stripe' } },
    analytics: { enabled: true, privateKey: 'secret-unknown' },
    deployment: { mobile: { apiUrl: 'https://mobile.invalid', privateKey: 'secret-mobile' } },
  });
  const result = publicConfiguration(conf);
  expect(result.mobile.apiUrl).toBe('https://mobile.invalid');
  expect(result.analytics.enabled).toBe(true);
  expect(JSON.stringify(result)).not.toContain('secret-');
  expect(JSON.stringify(clearReadableConf(conf))).not.toContain('secret-');
});

it('migration preserves JSON values, merges explicit env once, and backs up the original', () => {
  const original = JSON.stringify({ ...DEFAULT_VOCESPACE_CONFIG, account: undefined, deployment: undefined, billing: undefined, livekit: { url: 'wss://json.invalid', key: 'keep', secret: 'keep' } });
  fs.writeFileSync(file, original);
  const env = path.join(directory, '.env.local');
  fs.writeFileSync(env, 'LIVEKIT_API_KEY=do-not-use\nSUPABASE_SERVICE_ROLE_KEY=secret-migration\nAPI_PORT=3031\nWEBHOOK=false\nLICENSE_SECRET=keep-license\n');
  const run = spawnSync(process.execPath, ['scripts/config.mjs', 'migrate', '--config', file, '--env', env], { encoding: 'utf8' });
  expect(run.status, run.stderr).toBe(0);
  expect(run.stdout + run.stderr).not.toContain('secret-migration');
  const conf = readConfiguration({ file });
  expect(conf.livekit.key).toBe('keep');
  expect(conf.account.supabase.serviceRoleKey).toBe('secret-migration');
  expect(conf.deployment.api.port).toBe(3031);
  expect(conf.billing.stripe.enabled).toBe(false);
  expect(conf.billing.licenseSecret).toBe('keep-license');
  const backup = fs.readdirSync(directory).find(name => name.includes('.backup-'))!;
  expect(fs.readFileSync(path.join(directory, backup), 'utf8')).toBe(original);
  expect(fs.statSync(file).mode & 0o777).toBe(0o600);
});

it('Expo receives only the public mobile/analytics projection', () => {
  const conf = normalizeConfiguration({ account: { supabase: { serviceRoleKey: 'secret-server' } } });
  const publicFile = { ...publicConfiguration(conf), account: conf.account };
  fs.writeFileSync(path.join(directory, 'vocespace.public.json'), JSON.stringify(publicFile));
  const require = createRequire(path.resolve('apps/mobile/app.config.js'));
  const factory = new Function('require', '__dirname', 'module', fs.readFileSync('apps/mobile/app.config.js', 'utf8'));
  const module = { exports: {} as (arg: object) => object };
  factory(require, directory, module);
  const output = module.exports({ config: { name: 'fixture' } });
  expect(JSON.stringify(output)).not.toContain('secret-server');
  expect(output).toMatchObject({ extra: { vocespace: { mobile: { apiUrl: 'https://vocespace.com' } } } });
});
