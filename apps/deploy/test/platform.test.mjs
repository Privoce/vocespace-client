import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createAuth, sameToken } from '../server/auth.mjs';
import { createDeployServer } from '../server/http.mjs';
import { createJobStore, validateAction, atomicJson } from '../server/jobs.mjs';
import { snapshot, removeRelease, verifyRollback } from '../server/releases.mjs';
import { createLog, executeJob, runCommand } from '../server/runner.mjs';

const write = (file, contents) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof contents === 'string' ? contents : JSON.stringify(contents)); };
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vocespace-deploy-ui-test-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'releases'));
  const config = path.join(root, 'api-data/vocespace.conf.json');
  write(config, { hostToken: 'test-only-token' });
  return { root, config };
}
function release(root, name, projects = ['web', 'api']) {
  const directory = path.join(root, 'releases', name);
  write(path.join(directory, '.deploy.json'), { root, projects, builtAt: '2026-11-03T00:00:00Z' });
  for (const file of ['.deploy-ready', 'ecosystem.config.cjs', ...(projects.includes('web') ? ['apps/web/server.js', 'apps/web/.next/BUILD_ID'] : []), ...(projects.includes('platform') ? ['apps/platform/server.mjs', 'apps/platform/.next/BUILD_ID'] : []), ...(projects.includes('api') ? ['services/api/start.mjs', 'services/api/dist/api.cjs', 'services/api/dist/default-config.cjs', 'services/api/dist/preview/renderer.js'] : [])]) write(path.join(directory, file), 'fixture');
  return directory;
}
function state(root, current, previous = null) {
  write(path.join(root, '.deploy-state.json'), { version: 1, projects: { web: { current, previous }, api: { current, previous } } });
}
const procs = (current) => ['web', 'api'].map((p) => ({ name: `vocespace-${p}`, pm2_env: { pm_exec_path: path.join(current, p === 'web' ? 'apps/web/server.js' : 'services/api/start.mjs'), exec_mode: 'fork_mode' } }));

test('hostToken verification, expiration and config rotation invalidate sessions without exposing token', (t) => {
  const f = fixture(t); let now = 0;
  const auth = createAuth(f.config, () => now);
  assert.equal(sameToken('', ''), false);
  assert.equal(sameToken(['test-only-token'], 'test-only-token'), false);
  assert.equal(auth.login('wrong', 'test').status, 401);
  const login = auth.login('test-only-token', 'test');
  assert.equal(login.status, 200); assert.ok(!login.id.includes('test-only-token'));
  const req = { headers: { cookie: `vocespace_deploy_session=${login.id}` } };
  assert.equal(auth.authorized(req), true);
  write(f.config, { hostToken: 'rotated-token' });
  assert.equal(auth.authorized(req), false);
  write(f.config, { hostToken: 'test-only-token' });
  assert.equal(auth.authorized(req), false);
  const renewed = auth.login('test-only-token', 'test');
  req.headers.cookie = `vocespace_deploy_session=${renewed.id}`;
  now = 8 * 3600_000;
  assert.equal(auth.authorized(req), false);
  for (let i = 0; i < 10; i++) assert.equal(auth.login('wrong', 'rate-test').status, 401);
  assert.equal(auth.login('wrong', 'rate-test').status, 429);
});

test('every management endpoint requires a session; cross-site actions and unexpected input fail closed', async (t) => {
  const f = fixture(t); const calls = [];
  const store = { list: () => ({ active: null, jobs: [] }), get: () => ({ log: 'safe log' }), start: (input) => { calls.push(validateAction(input)); return { id: 'test' }; } };
  const server = createDeployServer({ ...f, source: f.root, assets: path.resolve('client'), store, readSnapshot: () => ({ projects: {}, versions: [] }), readBranches: async () => ({ branches: ['main', 'feature/rebuild'] }) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (url, data, cookie = '', origin = base) => fetch(`${base}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie }, body: JSON.stringify(data) });
  assert.equal((await fetch(`${base}/api/state`)).status, 401);
  assert.equal((await fetch(`${base}/api/branches`)).status, 401);
  assert.equal((await fetch(`${base}/api/jobs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)).status, 401);
  assert.equal((await post('/api/jobs', { action: 'delete', project: 'web', version: 'old' })).status, 401);
  assert.equal((await post('/api/login', { hostToken: 'wrong' })).status, 401);
  const login = await post('/api/login', { hostToken: 'test-only-token' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.ok(!(await login.text()).includes('test-only-token'));
  assert.equal((await post('/api/jobs', { action: 'create', project: 'web', version: 'web-002', branch: 'feature/rebuild' }, cookie, 'https://evil.invalid')).status, 403);
  for (const data of [
    { action: 'create', project: 'web', version: '../../oops', branch: 'feature/rebuild' },
    { action: 'create', project: 'web', version: 'x;echo bad', branch: 'feature/rebuild' },
    { action: 'create', project: 'mobile', version: 'old' },
    { action: 'create', project: 'web', version: 'ok', branch: 'feature/rebuild', command: 'echo bad' },
  ]) assert.equal((await post('/api/jobs', data, cookie)).status, 400);
  assert.equal((await post('/api/jobs', { action: 'create', project: 'web', version: 'web-002', branch: 'feature/rebuild' }, cookie)).status, 202);
  assert.equal(calls.length, 1);
  assert.deepEqual(await (await fetch(`${base}/api/branches`, { headers: { Cookie: cookie } })).json(), { branches: ['main', 'feature/rebuild'] });
  assert.equal((await fetch(`${base}/api/state`, { headers: { Cookie: cookie } })).status, 200);
  assert.equal((await post('/api/logout', {}, cookie)).status, 200);
  assert.equal((await fetch(`${base}/api/state`, { headers: { Cookie: cookie } })).status, 401);
  assert.equal((await fetch(`${base}/api-data/vocespace.conf.json`)).status, 404);
});

test('current/previous and arbitrary PM2 references are protected; cleaning a release never follows nested symlinks', (t) => {
  const { root } = fixture(t);
  const current = release(root, 'current'); const previous = release(root, 'previous'); const old = release(root, 'old');
  state(root, current, previous);
  const listing = snapshot(root);
  assert.equal(listing.versions.find(v => v.name === 'current').protected, true);
  assert.equal(listing.versions.find(v => v.name === 'previous').protected, true);
  assert.throws(() => removeRelease(root, 'current', procs(current)), /不能删除/);
  assert.throws(() => removeRelease(root, 'previous', procs(current)), /不能删除/);
  assert.throws(() => removeRelease(root, '../../api-data', procs(current)), /版本名/);
  assert.throws(() => removeRelease(root, 'old', [...procs(current), { name: 'custom-app', pm2_env: { pm_cwd: old } }]), /PM2/);
  assert.throws(() => removeRelease(root, 'old', []), /does not match/);
  fs.symlinkSync(path.join(root, 'api-data'), path.join(root, 'releases', 'outside'));
  assert.throws(() => removeRelease(root, 'outside', procs(current)), /普通目录/);
  fs.symlinkSync(path.join(root, 'api-data'), path.join(old, 'nested'));
  removeRelease(root, 'old', procs(current));
  assert.equal(fs.existsSync(old), false);
  assert.equal(fs.existsSync(path.join(root, 'api-data/vocespace.conf.json')), true);
  const partial = release(root, 'web-only', ['web']);
  verifyRollback(root, 'web-only', 'web');
  assert.throws(() => verifyRollback(root, 'web-only', 'api'), /not built/);
  fs.unlinkSync(path.join(partial, '.deploy-ready'));
  assert.throws(() => verifyRollback(root, 'web-only', 'web'), /构建完成/);
});

test('persistent jobs reject concurrent starts and survive reopening the UI server', (t) => {
  const { root } = fixture(t); let launches = 0;
  const launch = () => { launches++; const child = new EventEmitter(); child.pid = process.pid; child.unref = () => {}; return child; };
  const options = { root, source: root, launch };
  const store = createJobStore(options);
  const job = store.start({ action: 'create', project: 'web', version: 'web-002', branch: 'feature/rebuild' });
  assert.equal(launches, 1);
  const reopened = createJobStore(options);
  assert.equal(reopened.list().active, job.id);
  assert.throws(() => reopened.start({ action: 'delete', project: 'web', version: 'old' }), /正在运行/);
  const file = path.join(root, 'deploy-platform/jobs', `${job.id}.json`);
  atomicJson(file, { ...job, status: 'succeeded' });
  assert.equal(reopened.list().active, null);
  assert.equal(reopened.get(job.id).status, 'succeeded');
  assert.throws(() => reopened.get('../../config'), /不存在/);
});

test('stale worker is recorded as interrupted, never automatically retried', (t) => {
  const { root } = fixture(t);
  const jobs = path.join(root, 'deploy-platform/jobs');
  const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  write(path.join(jobs, `${id}.json`), { id, action: 'create', project: 'web', version: 'web-002', branch: 'feature/rebuild', status: 'running', createdAt: '2026-11-03' });
  write(path.join(root, 'deploy-platform/active.json'), { id, pid: 2147483647 });
  const store = createJobStore({ root, source: root, launch: () => { throw new Error('must not retry'); } });
  assert.equal(store.list().active, null);
  assert.equal(store.get(id).status, 'interrupted');
});

test('logs redact split tokens and authenticated Git URLs before writing to disk', (t) => {
  const { root } = fixture(t); const file = path.join(root, 'job.log');
  const log = createLog(file, { hostToken: 'private-token', redis: { password: 'redis-private' }, account: { supabase: { serviceRoleKey: 'service-private' } } });
  const stream = log.stream();
  stream.write('test private-'); stream.write('token redis-private\n');
  stream.write('https://user:git-secret@remote.invalid/repo service-private'); stream.end();
  const result = fs.readFileSync(file, 'utf8');
  for (const secret of ['private-token', 'redis-private', 'service-private', 'git-secret']) assert.ok(!result.includes(secret));
  assert.match(result, /REDACTED/);
});

test('create and update fetch/reset the selected branch before building; failures stop activation', async (t) => {
  const { root } = fixture(t); const calls = []; const log = { append() {} };
  const run = async (command, args) => {
    calls.push([command, ...args]);
    return args[0] === 'remote' ? 'git@github.com:Privoce/vocespace-client.git' : '';
  };
  const base = { root, source: '/checkout', log, lockFd: 9, run };
  for (const action of ['create', 'update']) {
    calls.length = 0;
    await executeJob({ ...base, job: { action, project: 'api', version: 'api-002', branch: 'feature/rebuild' } });
    assert.deepEqual(calls.slice(1, 3), [
      ['git', 'fetch', '--no-tags', 'origin', '+refs/heads/feature/rebuild:refs/remotes/origin/feature/rebuild'],
      ['git', 'reset', '--hard', 'refs/remotes/origin/feature/rebuild'],
    ]);
    assert.deepEqual(calls.slice(4).map(c => c.slice(2)), [['build', root, 'api-002', '-p', 'api'], ['activate', root, 'api-002', '-p', 'api']]);
  }
  for (const failAt of ['fetch', 'reset', 'build']) {
    calls.length = 0;
    await assert.rejects(executeJob({ ...base, job: { action: 'create', project: 'web', version: 'new', branch: 'main' }, run: async (command, args) => {
      if (args.includes(failAt)) throw new Error('failed step');
      return run(command, args);
    } }), /failed step/);
    assert.ok(!calls.some(c => c.includes('activate')));
  }
  calls.length = 0;
  await assert.rejects(executeJob({ ...base, job: { action: 'update', project: 'web', version: 'new', branch: 'main' }, run: async (command, args) => {
    calls.push([command, ...args]); return 'https://github.com/other/repo.git';
  } }), /origin/);
  assert.equal(calls.length, 1);
});

test('subprocess output is logged, errors propagate, and captured PM2 data is not logged', async (t) => {
  const { root } = fixture(t); const file = path.join(root, 'command.log');
  const log = createLog(file, { hostToken: 'do-not-print' });
  const lockFd = fs.openSync(path.join(root, '.lock'), 'a'); t.after(() => fs.closeSync(lockFd));
  const opts = { cwd: root, log, lockFd };
  await runCommand(process.execPath, ['-e', 'process.stdout.write("do-not-");setTimeout(()=>console.log("print"),5)'], opts);
  await assert.rejects(runCommand(process.execPath, ['-e', 'console.error("failed step");process.exit(2)'], opts), /失败/);
  assert.equal(await runCommand(process.execPath, ['-e', 'console.log("secret pm2 state")'], { ...opts, capture: true }), 'secret pm2 state\n');
  const result = fs.readFileSync(file, 'utf8');
  assert.match(result, /failed step/); assert.ok(!result.includes('do-not-print')); assert.ok(!result.includes('secret pm2 state'));
});

test('detached worker persists build/activate output and passes the shared lock descriptor', async (t) => {
  const { root } = fixture(t);
  const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  const executable = (name, code) => { const file = path.join(bin, name); write(file, `#!${process.execPath}\n${code}`); fs.chmodSync(file, 0o700); };
  executable('git', `if (process.argv[2] === 'remote') console.log('https://github.com/Privoce/vocespace-client.git');`);
  executable('flock', 'require("node:fs").fstatSync(3); process.exit(0);');
  executable('bash', `
    const fs = require('node:fs'); const path = require('node:path');
    const [, action, root, version, , project] = process.argv.slice(2);
    if (fs.fstatSync(9).ino !== fs.statSync(path.join(root, '.deploy.lock')).ino) process.exit(3);
    fs.appendFileSync(path.join(root, 'invocations'), action + ' ' + project + ' ' + version + '\\n');
    console.log(action + ' test-only-token');
    setTimeout(() => process.exit(0), 80);
  `);
  const { spawn } = await import('node:child_process');
  const store = createJobStore({ root, source: root, launch: (command, args, options) => spawn(command, args, { ...options, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } }) });
  const job = store.start({ action: 'create', project: 'web', version: 'web-009', branch: 'feature/rebuild' });
  let result;
  for (let i = 0; i < 200; i++) {
    result = store.get(job.id);
    if (['succeeded', 'failed', 'interrupted'].includes(result.status)) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.equal(result.status, 'succeeded', result.log);
  assert.match(result.log, /build/); assert.match(result.log, /activate/);
  assert.ok(!result.log.includes('test-only-token'));
  assert.equal(fs.readFileSync(path.join(root, 'invocations'), 'utf8'), 'build web web-009\nactivate web web-009\n');
});


test('Platform releases are selectable, validated and protected independently of Web/API', (t) => {
  const { root } = fixture(t);
  const base = release(root, 'base'); state(root, base);
  assert.deepEqual(snapshot(root).projects.platform, { current: null, previous: null });
  const platform = release(root, 'platform-one', ['platform']);
  assert.deepEqual(validateAction({ action: 'create', project: 'platform', version: 'platform-two', branch: 'feature/rebuild' }),
    { action: 'create', project: 'platform', version: 'platform-two', branch: 'feature/rebuild' });
  verifyRollback(root, 'platform-one', 'platform');
  assert.throws(() => verifyRollback(root, 'platform-one', 'web'), /not built/);
  write(path.join(root, '.deploy-state.json'), { version: 1, projects: {
    web: { current: base, previous: null }, api: { current: base, previous: null },
    platform: { current: platform, previous: null },
  } });
  const listing = snapshot(root);
  assert.equal(listing.projects.platform.current, 'platform-one');
  assert.equal(listing.projects.web.current, 'base');
  assert.equal(listing.versions.find(v => v.name === 'platform-one').protected, true);
  assert.throws(() => removeRelease(root, 'platform-one', [...procs(base), { name: 'vocespace-platform', pm2_env: {
    pm_exec_path: path.join(platform, 'apps/platform/server.mjs'), exec_mode: 'fork_mode',
  } }]), /不能删除/);
  const incomplete = release(root, 'platform-incomplete', ['platform']);
  fs.unlinkSync(path.join(incomplete, 'apps/platform/.next/BUILD_ID'));
  assert.equal(snapshot(root).versions.find(v => v.name === 'platform-incomplete').ready, false);
  fs.unlinkSync(path.join(platform, 'apps/platform/.next/BUILD_ID'));
  assert.throws(() => snapshot(root), /Missing artifact/);
});
