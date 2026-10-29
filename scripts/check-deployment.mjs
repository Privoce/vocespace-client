/** Isolated JSON-only startup validation. No developer configuration or network. */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readConfiguration, publicConfiguration } from '../packages/config-node/index.cjs';
const directory = mkdtempSync(path.join(tmpdir(), 'vocespace-config-'));
try {
  const file = path.join(directory, 'vocespace.conf.json');
  assert.throws(() => readConfiguration({ file }), /Cannot read/);
  const fixture = {
    livekit: { url: 'wss://rtc.invalid', key: 'private', secret: 'private' },
    account: { supabase: { serviceRoleKey: 'private' } },
    deployment: { api: { port: 3199 }, web: { port: 3198 } },
  };
  writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
  const original = readFileSync(file, 'utf8');
  process.env.API_PORT = '9999';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'ignored-env';
  const conf = readConfiguration({ file });
  assert.equal(conf.deployment.api.port, 3199);
  assert.equal(conf.account.supabase.serviceRoleKey, 'private');
  assert.ok(!JSON.stringify(publicConfiguration(conf)).includes('private'));
  assert.equal(readFileSync(file, 'utf8'), original);
  writeFileSync(file, 'invalid-json');
  assert.throws(() => readConfiguration({ file }), /Cannot read/);
  assert.equal(readFileSync(file, 'utf8'), 'invalid-json');
  console.log('JSON-only deployment checks passed: missing/invalid fail closed, env ignored, public projection, files preserved.');
} finally { rmSync(directory, { recursive: true, force: true }); }
