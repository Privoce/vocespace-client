/** Run after pnpm build:api. Disposable API/config, no Redis or external services. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const workspace = fileURLToPath(new URL('../../', import.meta.url));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vocespace-origin-'));
const file = path.join(directory, 'vocespace.conf.json');
const origin = 'https://vocespace.com';
let child;
let address;
let conf;

function configure(publicOrigin) {
  conf.deployment.publicOrigin = publicOrigin;
  fs.writeFileSync(file, JSON.stringify(conf), { mode: 0o600 });
}

async function request(route, headers = {}, method = 'GET', body) {
  return fetch(`${address}${route}`, {
    method,
    headers: { Origin: origin, ...headers },
    body,
    signal: AbortSignal.timeout(5000),
  });
}

// Check the actual Engine.IO upgrade, independent of Socket.IO session authorization.
function upgrade(requestOrigin) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${address}/socket.io/?EIO=4&transport=websocket`, {
      headers: {
        Origin: requestOrigin,
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
      },
    });
    req.setTimeout(5000, () => req.destroy(new Error('Upgrade timed out')));
    req.on('upgrade', (res, socket) => {
      socket.destroy();
      resolve({ status: res.statusCode, body: '' });
    });
    req.on('response', (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  address = `http://127.0.0.1:${port}`;
  conf = JSON.parse(fs.readFileSync(path.join(workspace, 'vocespace.conf.example.json'), 'utf8'));
  conf.redis.enabled = false;
  conf.deployment.dataDir = '.';
  Object.assign(conf.deployment.api, { host: '127.0.0.1', port, workerEnabled: false });
  configure(origin);
  child = spawn(process.execPath, [path.join(workspace, 'services/api/start.mjs'), '--config', file], {
    cwd: directory, stdio: ['ignore', 'ignore', 'ignore'],
  });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Isolated API exited before startup');
    try { if ((await request('/healthz')).ok) return; } catch { /* Wait for startup. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Isolated API did not start');
});

after(async () => {
  try {
    if (child && child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
      try { await exited; } finally { clearTimeout(timer); }
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('a localhost publicOrigin reproduces HTTP and Socket.IO 403 behind a public proxy', async () => {
  configure('http://localhost:3000');
  const response = await request('/api/space?nameCheck=true', {
    'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin',
  }, 'POST', JSON.stringify({ spaceName: 'test', participantName: 'fixture-name' }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'ORIGIN_DENIED');
  assert.equal((await request('/socket.io/?EIO=4&transport=polling')).status, 403);
  // Engine.IO rejects polling with 403, but rejected upgrades use 400 + Forbidden.
  assert.deepEqual(await upgrade(origin), { status: 400, body: 'Forbidden' });
});

test('canonical public origin accepts HTTP, polling and websocket despite internal HTTP transport', async () => {
  configure('https://VOCESPACE.com:443/');
  assert.equal((await request('/api/hello')).status, 200);
  // Invalid input reaches business validation: no Redis fixture or real room is needed.
  const nameCheck = await request('/api/space?nameCheck=true', {
    'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin',
  }, 'POST', '{}');
  assert.equal(nameCheck.status, 400);
  assert.equal((await nameCheck.json()).error, 'Invalid username request');
  for (const [route, method] of [
    ['/api/space?spaceName=test&chat=true&history=true', 'GET'],
    ['/api/upload?tilePlayer=true', 'POST'],
    ['/api/space?participant=update&space=true', 'POST'],
  ]) {
    const response = await request(route, {}, method);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'SESSION_REQUIRED');
  }
  const polling = await request('/socket.io/?EIO=4&transport=polling');
  assert.equal(polling.status, 200);
  assert.ok((await polling.text()).startsWith('0'));
  assert.equal((await upgrade(origin)).status, 101);
});

test('foreign origins remain denied, including forged proxy headers', async () => {
  configure(origin);
  const foreign = 'https://foreign.invalid';
  const response = await request('/api/hello', {
    Origin: foreign, Host: 'foreign.invalid',
    'X-Forwarded-Host': 'foreign.invalid', 'X-Forwarded-Proto': 'https',
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'ORIGIN_DENIED');
  assert.equal((await request('/api/hello', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await request('/socket.io/?EIO=4&transport=polling', { Origin: foreign })).status, 403);
  assert.deepEqual(await upgrade(foreign), { status: 400, body: 'Forbidden' });
});
