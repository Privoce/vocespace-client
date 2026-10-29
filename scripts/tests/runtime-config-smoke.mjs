/** Exercise compiled API + standalone Web with disposable JSON, never real services. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
const workspace = path.resolve(process.argv[2]);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vocespace-runtime-'));
const children = [];
async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
try {
  const apiPort = await freePort(); const webPort = await freePort();
  const conf = JSON.parse(fs.readFileSync(path.join(workspace, 'vocespace.conf.example.json'), 'utf8'));
  conf.redis.enabled = false;
  conf.deployment.basePath = '/config-test';
  conf.deployment.publicOrigin = `http://127.0.0.1:${webPort}`;
  Object.assign(conf.deployment.api, { host: '127.0.0.1', port: apiPort, workerEnabled: false });
  Object.assign(conf.deployment.web, { host: '127.0.0.1', port: webPort, apiUrl: `http://127.0.0.1:${apiPort}` });
  conf.account.supabase.serviceRoleKey = 'RUNTIME_SECRET_SENTINEL';
  conf.analytics.websiteId = 'runtime-public-fixture';
  const file = path.join(directory, 'vocespace.conf.json');
  fs.writeFileSync(file, JSON.stringify(conf), { mode: 0o600 });
  fs.writeFileSync(path.join(directory, '.env.production'), 'API_PORT=1\nPORT=1\n');
  function start(script) {
    const child = spawn(process.execPath, [script, '--config', file], { cwd: directory, env: { ...process.env, NODE_ENV: 'production', API_PORT: '1', PORT: '1', VOCESPACE_API_URL: 'http://127.0.0.1:1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = ''; child.stdout.on('data', data => { logs += data; }); child.stderr.on('data', data => { logs += data; });
    children.push(child); return () => logs;
  }
  async function healthy(port, logs) {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Isolated process failed: ${logs()}`);
  }
  const apiLogs = start(process.argv[3] ? path.resolve(process.argv[3]) : path.join(workspace, 'services/api/start.mjs'));
  await healthy(apiPort, apiLogs);
  const webLogs = start(path.join(workspace, 'apps/web/.next/standalone/server.js'));
  await healthy(webPort, webLogs);
  const origin = `http://127.0.0.1:${webPort}`;
  const projected = await fetch(`${origin}/config-test/api/conf`);
  assert.equal(projected.status, 200);
  assert.ok(!(await projected.text()).includes('RUNTIME_SECRET_SENTINEL'));
  for (const route of ['/deleteAccount', '/legal/privacy']) {
    const response = await fetch(`${origin}/config-test${route}`);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.ok(html.includes('runtime-public-fixture'), `runtime public configuration missing in ${route}`);
    assert.ok(!html.includes('RUNTIME_SECRET_SENTINEL'));
    assert.ok(html.includes('/config-test/_next/'));
  }
  const socket = await fetch(`${origin}/config-test/socket.io/?EIO=4&transport=polling`);
  assert.equal(socket.status, 200);
  assert.ok((await socket.text()).startsWith('0'));
  conf.analytics.websiteId = 'changed-without-rebuild';
  fs.writeFileSync(file, JSON.stringify(conf));
  const changed = await (await fetch(`${origin}/config-test/deleteAccount`)).text();
  assert.ok(changed.includes('changed-without-rebuild'));
  console.log('Compiled JSON runtime smoke passed: isolated API/Web, legacy env ignored, subpath proxy/socket, dynamic public config and secrets excluded.');
} finally {
  await Promise.all(children.map(child => new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve); child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000); timer.unref();
  })));
  fs.rmSync(directory, { recursive: true, force: true });
}
