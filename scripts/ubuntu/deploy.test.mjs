/** Isolated lifecycle tests: no real PM2 daemon, Redis, network or app processes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { configuration, validateManaged } from './deploy-tools.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const helper = path.join(here, 'deploy-tools.mjs');
const bash = fs.readFileSync(path.join(here, 'deploy.sh'), 'utf8');
const write = (file, body, mode = 0o600) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, { mode });
};

test('PM2 config isolates API data, uses two ports and one API writer, never serializes secrets', () => {
  const config = configuration('/release', '/data root', { SUPABASE_SERVICE_ROLE_KEY: 'hidden', WEB_PORT: '3030', API_PORT: '3031' });
  assert.equal(config.apps[0].instances, 1);
  assert.equal(config.apps[0].exec_mode, 'fork');
  assert.equal(config.apps[0].env.VOCESPACE_DATA_DIR, '/data root/api-data');
  assert.equal(config.apps[1].env.VOCESPACE_API_URL, 'http://127.0.0.1:3031');
  assert.ok(!JSON.stringify(config).includes('hidden'));
  assert.throws(() => configuration('/r', '/d', { WEB_PORT: '3031', API_PORT: '3031' }));
  assert.throws(() => configuration('/r', '/d', { API_PORT: '0' }));
  assert.throws(() => configuration('/r', '/d', { NEXT_PUBLIC_BASE_PATH: '/test/' }));
});

test('refuses takeover of unmanaged/duplicate/cluster PM2 processes', () => {
  const processes = ['api', 'web'].map((kind) => ({ name: `vocespace-${kind}`, pm2_env: {
    pm_exec_path: `/old/${kind === 'api' ? 'services/api/start.mjs' : 'apps/web/server.js'}`, exec_mode: 'fork_mode',
  } }));
  validateManaged(processes, '/old');
  assert.throws(() => validateManaged(processes, ''));
  assert.throws(() => validateManaged(processes, '/other'));
  assert.throws(() => validateManaged([...processes, processes[0]], '/old'));
  processes[0].pm2_env.exec_mode = 'cluster_mode';
  assert.throws(() => validateManaged(processes, '/old'));
});

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocespace-deploy-test-'));
  const source = path.join(dir, 'source');
  const root = path.join(dir, 'deployment');
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(root);
  // Only remove host guards in the disposable COPY, so the lifecycle can be tested on macOS/CI root.
  let script = bash;
  const guards = [
    "[[ $(uname -s) = Linux && -f /etc/os-release ]] || { echo 'Run on Ubuntu.' >&2; exit 1; }\n",
    '. /etc/os-release\n',
    "[[ $ID = ubuntu && $EUID != 0 ]] || { echo 'Run as a non-root Ubuntu deployment user.' >&2; exit 1; }\n",
  ];
  for (const guard of guards) { assert.ok(script.includes(guard)); script = script.replace(guard, ''); }
  write(path.join(source, 'scripts/ubuntu/deploy.sh'), script);
  for (const name of ['api.env.example', 'source.exclude']) {
    write(path.join(source, 'scripts/ubuntu', name), fs.readFileSync(path.join(here, name)));
  }
  // Delegate real validation/config/backup logic; fake only liveness and port binding.
  write(path.join(source, 'scripts/ubuntu/deploy-tools.mjs'), `
    import { spawnSync } from 'node:child_process';
    import fs from 'node:fs';
    const args = process.argv.slice(2);
    if (args[0] === 'health') {
      fs.appendFileSync(process.env.TEST_LOG, 'health ' + args[1] + '\\n');
      process.exit(args[1].endsWith(process.env.FAIL_HEALTH || '__none__') ? 1 : 0);
    }
    if (args[0] === 'ports') process.exit(0);
    const result = spawnSync(process.execPath, [${JSON.stringify(helper)}, ...args], { stdio: 'inherit' });
    process.exit(result.status ?? 1);
  `);
  write(path.join(source, '.nvmrc'), process.versions.node);
  write(path.join(source, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.27.0' }));
  for (const file of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', '.eslintrc.json', '.prettierrc', '.prettierignore', 'LICENSE']) write(path.join(source, file), '{}');
  for (const folder of ['apps/web', 'packages', 'services/api', 'patches']) fs.mkdirSync(path.join(source, folder), { recursive: true });
  // Sensitive/generated inputs must not survive the release copy.
  for (const file of ['.env.local', 'vocespace.conf.json', 'apps/web/.env.production', 'services/api/uploads/private.txt', 'apps/mobile/credentials/key.p12', 'apps/web/.next/old', 'packages/test/node_modules/secret']) write(path.join(source, file), 'private');
  const executable = (name, code) => write(path.join(bin, name), `#!${process.execPath}\n${code}`, 0o700);
  executable('flock', 'process.exit(0)');
  // GNU mv -T atomically replaces a symlink; emulate that operation on macOS.
  executable('mv', `
    if (process.argv[2] !== '-Tf') process.exit(1);
    require('fs').renameSync(process.argv[3], process.argv[4]);
  `);
  executable('pnpm', `
    const fs = require('fs'); const path = require('path');
    const a = process.argv.slice(2);
    if (a[0] === '--version') { console.log('10.27.0'); process.exit(0); }
    fs.appendFileSync(process.env.TEST_LOG, 'pnpm ' + a.join(' ') + '\\n');
    if (a[0] === 'build' && process.env.FAIL_BUILD) process.exit(1);
    if (a[0] === 'build') for (const file of ['services/api/dist/api.cjs', 'services/api/dist/default-config.cjs', 'services/api/dist/preview/renderer.js', 'services/api/start.mjs', 'apps/web/server.js', 'apps/web/.next/BUILD_ID']) {
      fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, 'fixture');
    }
    if (a[0] === 'install') {
      fs.mkdirSync('services/api/node_modules/dotenv', { recursive: true });
      fs.writeFileSync('services/api/package.json', '{}');
      fs.writeFileSync('services/api/node_modules/dotenv/index.js', 'exports.parse = data => Object.fromEntries(String(data).split("\\\\n").filter(x => x && !x.startsWith("#")).map(x => [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)]));');
    }
  `);
  executable('pm2', `
    const fs = require('fs'); const a = process.argv.slice(2);
    let procs = fs.existsSync(process.env.TEST_STATE) ? JSON.parse(fs.readFileSync(process.env.TEST_STATE)) : [];
    fs.appendFileSync(process.env.TEST_LOG, 'pm2 ' + a.join(' ') + '\\n');
    if (a[0] === 'jlist') console.log(JSON.stringify(procs));
    if (a[0] === 'delete') procs = procs.filter(p => p.name !== a[1]);
    if (a[0] === 'start') {
      const app = require(a[1]).apps.find(p => p.name === a[3]);
      if (procs.some(p => p.name === app.name)) process.exit(1);
      procs.push({ name: app.name, pm2_env: { pm_exec_path: app.script, exec_mode: 'fork_mode' } });
    }
    fs.writeFileSync(process.env.TEST_STATE, JSON.stringify(procs));
  `);
  executable('redis-cli', `
    const fs = require('fs');
    fs.appendFileSync(process.env.TEST_LOG, 'redis-backup\\n');
    if (process.env.FAIL_BACKUP) process.exit(1);
    fs.writeFileSync(process.argv.at(-1), 'fixture-rdb');
  `);
  const env = { ...process.env, PATH: `${bin}:${path.dirname(process.execPath)}:${process.env.PATH}`, TEST_LOG: path.join(dir, 'log'), TEST_STATE: path.join(dir, 'state') };
  write(env.TEST_LOG, '');
  const run = (command, release, extra = {}) => spawnSync('bash', [path.join(source, 'scripts/ubuntu/deploy.sh'), command, root, ...(release ? [release] : [])], { env: { ...env, ...extra }, encoding: 'utf8' });
  const success = (result) => assert.equal(result.status, 0, result.stdout + result.stderr);
  success(run('init'));
  const config = { livekit: { url: 'wss://rtc.invalid', key: 'test', secret: 'test' }, redis: { enabled: true, host: 'localhost', port: 6379, db: 0, password: 'private' }, hostToken: 'test' };
  write(path.join(root, 'api-data/vocespace.conf.json'), JSON.stringify(config));
  write(path.join(root, 'api-data/.env.production'), 'PUBLIC_ORIGIN=https://space.invalid\nACCOUNT_PUBLIC_URL=https://space.invalid\nSUPABASE_URL=https://supabase.invalid\nSUPABASE_PUBLISHABLE_KEY=test\nSUPABASE_SERVICE_ROLE_KEY=test\n');
  return { dir, root, env, run, success, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('build isolates data; init preserves configuration; failed build never stops PM2', () => {
  const f = fixture();
  try {
    const original = fs.readFileSync(path.join(f.root, 'api-data/.env.production'), 'utf8');
    f.success(f.run('init'));
    assert.equal(fs.readFileSync(path.join(f.root, 'api-data/.env.production'), 'utf8'), original);
    f.success(f.run('build', 'one'));
    for (const file of ['.env.local', 'vocespace.conf.json', 'apps/web/.env.production', 'services/api/uploads/private.txt', 'apps/mobile/credentials/key.p12', 'apps/web/.next/old', 'packages/test/node_modules/secret']) {
      assert.equal(fs.existsSync(path.join(f.root, 'releases/one', file)), false, file);
    }
    assert.notEqual(f.run('build', 'one').status, 0);
    assert.notEqual(f.run('build', 'failed', { FAIL_BUILD: '1' }).status, 0);
    assert.equal(fs.existsSync(path.join(f.root, 'releases/failed/.deploy-ready')), false);
    assert.ok(!fs.readFileSync(f.env.TEST_LOG, 'utf8').includes('pm2 stop'));
  } finally { f.cleanup(); }
});

test('activate backs up then starts; failed health and backup restore old processes; rollback retains data', () => {
  const f = fixture();
  try {
    for (const name of ['one', 'two']) f.success(f.run('build', name));
    f.success(f.run('activate', 'one'));
    const current = () => fs.readlinkSync(path.join(f.root, 'current'));
    assert.ok(current().endsWith('/one'));
    const failedHealth = f.run('activate', 'two', { FAIL_HEALTH: '/two' });
    assert.notEqual(failedHealth.status, 0);
    assert.ok(current().endsWith('/one'));
    assert.ok(JSON.parse(fs.readFileSync(f.env.TEST_STATE)).every(p => p.pm2_env.pm_exec_path.includes('/one/')));
    const failedBackup = f.run('activate', 'two', { FAIL_BACKUP: '1' });
    assert.notEqual(failedBackup.status, 0);
    assert.ok(current().endsWith('/one'));
    f.success(f.run('activate', 'two'));
    assert.ok(current().endsWith('/two'));
    write(path.join(f.root, 'api-data/new-user-data'), 'retain');
    f.success(f.run('rollback'));
    assert.ok(current().endsWith('/one'));
    assert.equal(fs.readFileSync(path.join(f.root, 'api-data/new-user-data'), 'utf8'), 'retain');
    const backups = fs.readdirSync(path.join(f.root, 'backups'));
    assert.equal(backups.length, 5);
    assert.ok(backups.every(b => fs.existsSync(path.join(f.root, 'backups', b, 'api-data.tar.gz'))));
  } finally { f.cleanup(); }
});

test('invalid API config prevents stopping the running release', () => {
  const f = fixture();
  try {
    for (const name of ['one', 'two']) f.success(f.run('build', name));
    f.success(f.run('activate', 'one'));
    write(path.join(f.root, 'api-data/vocespace.conf.json'), 'invalid');
    write(f.env.TEST_LOG, '');
    assert.notEqual(f.run('activate', 'two').status, 0);
    assert.ok(!fs.readFileSync(f.env.TEST_LOG, 'utf8').includes('pm2 stop'));
    assert.equal(fs.readFileSync(path.join(f.root, 'api-data/vocespace.conf.json'), 'utf8'), 'invalid');
  } finally { f.cleanup(); }
});
