/** Disposable first-install/upgrade checks; never read the developer's configuration. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initializeData } from '../services/api/initialize-data.mjs';

const directory = await mkdtemp(path.join(tmpdir(), 'vocespace-install-'));
const env = {
  VOCESPACE_INIT_CONFIG: 'true', PUBLIC_ORIGIN: 'https://web.example.test',
  LIVEKIT_URL: 'wss://rtc.example.test', LIVEKIT_API_KEY: 'test-only',
  LIVEKIT_API_SECRET: 'test-only-secret', HOST_TOKEN: 'test-only-admin-token',
  REDIS_HOST: 'redis.example.test', REDIS_PORT: '6380', REDIS_DB: '2',
  REDIS_PASSWORD: 'test-only-redis',
};
try {
  assert.equal(initializeData(directory, {}), false, 'workspace startup stays opt-in');
  assert.throws(() => initializeData(directory, { VOCESPACE_INIT_CONFIG: 'true' }), /requires/);
  assert.throws(() => initializeData(directory, { ...env, REDIS_PORT: 'not-a-port' }), /Invalid Redis/);
  await assert.rejects(readFile(path.join(directory, 'vocespace.conf.json')), { code: 'ENOENT' });
  assert.equal(initializeData(directory, env), true);
  const file = path.join(directory, 'vocespace.conf.json');
  const original = await readFile(file, 'utf8');
  const config = JSON.parse(original);
  assert.equal(config.livekit.url, env.LIVEKIT_URL);
  assert.equal(config.redis.host, env.REDIS_HOST);
  assert.equal(config.redis.port, 6380);
  assert.equal(config.redis.db, 2);
  assert.equal(config.serverUrl, 'web.example.test');
  assert.equal(config.hostToken, env.HOST_TOKEN);
  if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.equal(initializeData(directory, { VOCESPACE_INIT_CONFIG: 'true' }), false);
  assert.equal(await readFile(file, 'utf8'), original, 'restart never overwrites configuration');
  // Even an invalid existing config is preserved for operator repair, never silently reset.
  await writeFile(file, 'broken-existing-config');
  assert.equal(initializeData(directory, env), false);
  assert.equal(await readFile(file, 'utf8'), 'broken-existing-config');
  console.log('Installation checks passed: opt-in, required inputs, creation, file mode, restart and preservation.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
