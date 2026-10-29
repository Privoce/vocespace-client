/** Isolated lifecycle tests: no real PM2 daemon, Redis, network or app processes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeConfiguration } from '../../packages/config-node/index.cjs';
import { configuration, validateManaged } from './deploy-tools.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const helper = path.join(here, 'deploy-tools.mjs');
const bash = fs.readFileSync(path.join(here, 'deploy.sh'), 'utf8');
const write = (file, body, mode = 0o600) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, { mode });
};

for (const [uid, scenario] of [['0', 'default'], ['1000', 'default'], ['0', 'selected'], ['1000', 'selected'], ['0', 'missing'], ['0', 'update_failure']]) {
  test(`setup uid ${uid}: ${scenario} sources and privilege handling`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocespace-setup-test-'));
    try {
      const source = path.join(dir, 'source');
      const root = path.join(dir, 'deployment');
      const bin = path.join(dir, 'bin');
      const log = path.join(dir, 'log');
      let script = fs.readFileSync(path.join(here, 'setup.sh'), 'utf8');
      // Emulate only the host and effective uid; all installer actions are local stubs.
      for (const guard of [
        "[[ $(uname -s) = Linux && -f /etc/os-release ]] || { echo 'Ubuntu is required.' >&2; exit 1; }\n",
        '. /etc/os-release\n',
        "[[ $ID = ubuntu ]] || { echo 'Ubuntu is required.' >&2; exit 1; }\n",
      ]) {
        assert.ok(script.includes(guard));
        script = script.replace(guard, '');
      }
      script = script.replaceAll('$EUID', '${TEST_EUID}');
      write(path.join(source, 'scripts/ubuntu/setup.sh'), script);
      write(path.join(source, '.nvmrc'), process.versions.node);
      write(path.join(source, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.27.0' }));
      const nodeRoot = path.join(root, 'tools', `node-v${process.versions.node}-linux-${process.arch}`);
      fs.mkdirSync(nodeRoot, { recursive: true });
      write(log, '');
      const aptSources = path.join(dir, 'Ubuntu sources', 'ubuntu.sources');
      const sourceText = 'Types: deb\nURIs: https://archive.ubuntu.com/ubuntu\nSuites: questing\nComponents: main universe\n';
      write(aptSources, sourceText);
      for (const name of ['apt-get', 'npm', 'pm2', 'flock', 'sudo', 'curl']) {
        write(path.join(bin, name), `#!${process.execPath}
          const fs = require('node:fs');
          const args = process.argv.slice(2);
          fs.appendFileSync(process.env.TEST_LOG, JSON.stringify([${JSON.stringify(name)}, ...args]) + '\\n');
          if (${JSON.stringify(name)} === 'curl') process.exit(1);
          if (${JSON.stringify(name)} === 'apt-get' && args.includes('update') && process.env.FAIL_APT_UPDATE === '1') process.exit(100);
          if (${JSON.stringify(name)} === 'sudo') {
            const result = require('node:child_process').spawnSync(args[0], args.slice(1), { stdio: 'inherit' });
            process.exit(result.status ?? 1);
          }
        `, 0o700);
      }
      const result = spawnSync('bash', [path.join(source, 'scripts/ubuntu/setup.sh'), root], {
        env: { ...process.env, TEST_EUID: uid, TEST_LOG: log,
          VOCESPACE_APT_SOURCES: scenario === 'selected' ? aptSources : scenario === 'missing' ? path.join(dir, 'missing.sources') : '',
          FAIL_APT_UPDATE: scenario === 'update_failure' ? '1' : '',
          PATH: `${bin}:${path.dirname(process.execPath)}:${process.env.PATH}` }, encoding: 'utf8',
      });
      const entries = fs.readFileSync(log, 'utf8').trim();
      const calls = entries ? entries.split('\n').map(line => JSON.parse(line)) : [];
      assert.equal(fs.readFileSync(aptSources, 'utf8'), sourceText);
      if (scenario === 'missing' || scenario === 'update_failure') {
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, scenario === 'missing' ? /VOCESPACE_APT_SOURCES must/ : /APT update failed/);
        assert.equal(calls.length, scenario === 'missing' ? 0 : 1);
        assert.ok(!fs.existsSync(path.join(root, 'tools/env.sh')));
        return;
      }
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const aptOptions = scenario === 'selected' ? ['-o', `Dir::Etc::sourcelist=${aptSources}`, '-o', 'Dir::Etc::sourceparts=-', '-o', 'APT::Get::List-Cleanup=false'] : [];
      const aptCalls = calls.filter(call => call[0] === 'apt-get');
      assert.deepEqual(aptCalls[0], ['apt-get', ...aptOptions, 'update']);
      assert.deepEqual(aptCalls[1], ['apt-get', ...aptOptions, 'install', '-y', 'ca-certificates', 'curl', 'xz-utils', 'git', 'rsync', 'build-essential', 'python3', 'redis-tools', 'util-linux']);
      assert.equal(calls.filter(call => call[0] === 'sudo').length, uid === '0' ? 0 : 2);
      assert.equal(calls.filter(call => call[0] === 'apt-get').length, 2);
      assert.deepEqual(calls.find(call => call[0] === 'npm'),
        ['npm', 'install', '--global', '--prefix', nodeRoot, 'pnpm@10.27.0']);
      assert.ok(!calls.some(call => call[0] === 'pm2' || call[0] === 'curl'));
      assert.ok(fs.readFileSync(path.join(root, 'tools/env.sh'), 'utf8').includes(nodeRoot));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}

test('PM2 config isolates API data, uses two ports and one API writer, never serializes secrets', () => {
  const input = normalizeConfiguration({ account: { supabase: { serviceRoleKey: 'hidden' } }, deployment: { web: { port: 3030 }, api: { port: 3031 } } });
  const config = configuration('/release', '/data root', input);
  assert.equal(config.apps[0].instances, 1);
  assert.equal(config.apps[0].exec_mode, 'fork');
  assert.deepEqual(config.apps[0].args, ['--config', '/data root/api-data/vocespace.conf.json']);
  assert.deepEqual(config.apps[1].env, { NODE_ENV: 'production' });
  assert.ok(!JSON.stringify(config).includes('hidden'));
  input.deployment.api.port = 3030;
  assert.throws(() => configuration('/r', '/d', input));

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
  // Only remove Ubuntu host guards in the disposable COPY for macOS tests.
  let script = bash;
  const guards = [
    "[[ $(uname -s) = Linux && -f /etc/os-release ]] || { echo 'Run on Ubuntu.' >&2; exit 1; }\n",
    '. /etc/os-release\n',
    "[[ $ID = ubuntu ]] || { echo 'Run on Ubuntu.' >&2; exit 1; }\n",
  ];
  for (const guard of guards) { assert.ok(script.includes(guard)); script = script.replace(guard, ''); }
  write(path.join(source, 'scripts/ubuntu/deploy.sh'), script);
  for (const name of ['source.exclude']) {
    write(path.join(source, 'scripts/ubuntu', name), fs.readFileSync(path.join(here, name)));
  }
  write(path.join(source, 'vocespace.conf.example.json'), fs.readFileSync(path.join(here, '../../vocespace.conf.example.json')));
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
    fs.appendFileSync(process.env.TEST_LOG, 'redis-backup ' + process.argv.slice(2).join(' ') + '\\n');
    if (process.env.FAIL_BACKUP) process.exit(1);
    fs.writeFileSync(process.argv.at(-1), 'fixture-rdb');
  `);
  const env = { ...process.env, PATH: `${bin}:${path.dirname(process.execPath)}:${process.env.PATH}`, TEST_LOG: path.join(dir, 'log'), TEST_STATE: path.join(dir, 'state') };
  write(env.TEST_LOG, '');
  const run = (command, release, extra = {}) => spawnSync('bash', [path.join(source, 'scripts/ubuntu/deploy.sh'), command, root, ...(release ? [release] : [])], { env: { ...env, ...extra }, encoding: 'utf8' });
  const success = (result) => assert.equal(result.status, 0, result.stdout + result.stderr);
  success(run('init'));
  const config = { account: { supabase: { url: 'https://supabase.invalid', publishableKey: 'test', serviceRoleKey: 'private' } }, deployment: { publicOrigin: 'https://space.invalid', web: { port: 3030 }, api: { port: 3031 } }, livekit: { url: 'wss://rtc.invalid', key: 'test', secret: 'test' }, redis: { enabled: true, host: 'localhost', port: 6379, db: 0, password: 'private' }, hostToken: 'test' };
  write(path.join(root, 'api-data/vocespace.conf.json'), JSON.stringify(config));
  write(path.join(root, 'api-data/.env.production'), 'PUBLIC_ORIGIN=https://space.invalid\nACCOUNT_PUBLIC_URL=https://space.invalid\nSUPABASE_URL=https://supabase.invalid\nSUPABASE_PUBLISHABLE_KEY=test\nSUPABASE_SERVICE_ROLE_KEY=test\n');
  return { dir, root, env, run, success, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('build isolates data; init preserves configuration; failed build never stops PM2', () => {
  const f = fixture();
  try {
    const original = fs.readFileSync(path.join(f.root, 'api-data/vocespace.conf.json'), 'utf8');
    f.success(f.run('init'));
    assert.equal(fs.readFileSync(path.join(f.root, 'api-data/vocespace.conf.json'), 'utf8'), original);
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

test('JSON drives activation and Redis backup despite conflicting legacy environment', () => {
  const f = fixture();
  try {
    f.success(f.run('build', 'one'));
    const file = path.join(f.root, 'api-data/vocespace.conf.json');
    const original = fs.readFileSync(file, 'utf8');
    const result = f.run('activate', 'one', {
      VOCESPACE_INIT_CONFIG: 'true', LIVEKIT_URL: 'invalid', LIVEKIT_API_KEY: '',
      LIVEKIT_API_SECRET: '', HOST_TOKEN: '', REDIS_HOST: 'wrong-host', REDIS_PORT: 'invalid',
    });
    f.success(result);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
    const log = fs.readFileSync(f.env.TEST_LOG, 'utf8');
    assert.ok(log.includes('localhost'));
    assert.ok(!log.includes('wrong-host'));
  } finally { f.cleanup(); }
});

test('missing JSON cannot be replaced by bootstrap environment during activation', () => {
  const f = fixture();
  try {
    for (const name of ['one', 'two']) f.success(f.run('build', name));
    f.success(f.run('activate', 'one'));
    const file = path.join(f.root, 'api-data/vocespace.conf.json');
    fs.unlinkSync(file);
    write(f.env.TEST_LOG, '');
    const result = f.run('activate', 'two', {
      VOCESPACE_INIT_CONFIG: 'true', LIVEKIT_URL: 'wss://rtc.invalid',
      LIVEKIT_API_KEY: 'test', LIVEKIT_API_SECRET: 'test', HOST_TOKEN: 'test',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Cannot read configuration JSON/);
    assert.ok(!fs.existsSync(file));
    assert.ok(!fs.readFileSync(f.env.TEST_LOG, 'utf8').includes('pm2 stop'));
  } finally { f.cleanup(); }
});
