/** Disposable local Native/Web POC. No developer config is read; stop with Ctrl-C. */
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { createSocket } from 'node:dgram';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import Redis from 'ioredis';

const root = process.cwd();
const directory = await mkdtemp(path.join(tmpdir(), 'vocespace-native-poc-'));
const children = [];
let redis, web;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  web?.close();
  redis?.disconnect();
  for (const child of children) child.kill('SIGTERM');
  await Promise.all(
    children.map(
      (child) =>
        new Promise((resolve) => {
          if (child.exitCode !== null || child.signalCode) return resolve();
          child.once('exit', resolve);
          setTimeout(resolve, 2000).unref();
        }),
    ),
  );
  await rm(directory, { recursive: true, force: true });
}
process.on('SIGINT', () => {
  void stop().then(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void stop().then(() => process.exit(0));
});
const port = async () => {
  const server = createTcpServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return value;
};
const udpPort = async () => {
  const socket = createSocket('udp4');
  await new Promise((resolve) => socket.bind(0, '127.0.0.1', resolve));
  const value = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return value;
};
const run = (command, args, env = {}, cwd = directory) => {
  const child = spawn(command, args, {
    cwd,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      LANG: process.env.LANG,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  child.on('error', (error) => console.error(error.message));
  child.stderr.on('data', (data) => process.stderr.write(data));
  // Do not print server stdout, which can include fixture tokens or session data.
  child.stdout.resume();
  return child;
};
async function ready(action) {
  for (let n = 0; n < 150; n++) {
    try {
      return await action();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Disposable POC service failed to start');
}
try {
  const redisPort = await port(),
    apiPort = await port(),
    mediaPort = await port();
  const mediaTcpPort = await port(),
    mediaUdpPort = await udpPort(),
    webPort = await port();
  const apiOrigin = `http://127.0.0.1:${apiPort}`;
  const webOrigin = `http://127.0.0.1:${webPort}`;
  const mediaUrl = `ws://127.0.0.1:${mediaPort}`;
  const roomName = 'NativeChatPOC';
  await build({
    stdin: {
      contents:
        "export { DEFAULT_SPACE_INFO, DEFAULT_PARTICIPANT_SETTINGS } from './lib/std/space'; export { DEFAULT_VOCESPACE_CONFIG } from './lib/std/conf';",
      resolveDir: root,
      loader: 'ts',
    },
    outfile: path.join(directory, 'fixtures.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    tsconfig: path.join(root, 'tsconfig.json'),
    logLevel: 'silent',
  });
  const require = createRequire(import.meta.url);
  const { DEFAULT_SPACE_INFO, DEFAULT_PARTICIPANT_SETTINGS, DEFAULT_VOCESPACE_CONFIG } = require(
    path.join(directory, 'fixtures.cjs'),
  );
  run('redis-server', [
    '--bind',
    '127.0.0.1',
    '--port',
    String(redisPort),
    '--save',
    '',
    '--appendonly',
    'no',
    '--dir',
    directory,
  ]);
  redis = new Redis({
    host: '127.0.0.1',
    port: redisPort,
    lazyConnect: true,
    retryStrategy: () => 100,
  });
  redis.on('error', () => {});
  await ready(() => redis.ping());
  const mediaKey = 'native-poc-only',
    mediaSecret = 'local-disposable-poc-secret-never-production';
  run('livekit-server', [
    '--dev',
    '--bind',
    '127.0.0.1',
    '--node-ip',
    '127.0.0.1',
    '--config-body',
    JSON.stringify({
      port: mediaPort,
      rtc: { tcp_port: mediaTcpPort, udp_port: mediaUdpPort, use_external_ip: false },
      keys: { [mediaKey]: mediaSecret },
      logging: { level: 'warn' },
    }),
  ]);
  await ready(async () => {
    if (!(await fetch(`http://127.0.0.1:${mediaPort}`)).ok) throw new Error('Media not ready');
  });
  await writeFile(
    path.join(directory, 'vocespace.conf.json'),
    JSON.stringify({
      ...DEFAULT_VOCESPACE_CONFIG,
      create_space: 'all',
      hostToken: 'local-poc-only',
      redis: { enabled: true, host: '127.0.0.1', port: redisPort, db: 0, password: '' },
      livekit: { url: mediaUrl, key: mediaKey, secret: mediaSecret, turn: [] },
    }),
  );
  run(
    process.execPath,
    [path.join(root, 'services/api/start.mjs')],
    {
      VOCESPACE_DATA_DIR: directory,
      VOCESPACE_PROMPT_DIR: path.join(root, 'prompt'),
      API_HOST: '127.0.0.1',
      API_PORT: String(apiPort),
      WORKER_ENABLED: 'false',
      NATIVE_CONFERENCE_SPACE: roomName,
      PUBLIC_ORIGIN: webOrigin,
    },
    path.join(root, 'services/api'),
  );
  await ready(async () => {
    if (!(await fetch(`${apiOrigin}/healthz`)).ok) throw new Error('API not ready');
  });
  const response = await fetch(
    `${apiOrigin}/api/connection-details?spaceName=${roomName}&participantName=Web%20POC`,
  );
  if (!response.ok) throw new Error('Cannot create fixture Web participant');
  const details = await response.json();
  const bearer = response.headers.get('set-cookie').split(';')[0].split('=')[1];
  const identity = JSON.parse(
    Buffer.from(details.participantToken.split('.')[1], 'base64url').toString(),
  ).sub;
  const room = {
    ...DEFAULT_SPACE_INFO(Date.now(), true),
    children: [],
    ownerId: identity,
    participants: {
      [identity]: { ...structuredClone(DEFAULT_PARTICIPANT_SETTINGS), name: 'Web POC' },
    },
  };
  await redis.set(`space:${roomName}`, JSON.stringify(room));
  await redis.sadd('space:list:', roomName);
  const source = `
    import { Room, RoomEvent, Track } from 'livekit-client';
    import { io } from 'socket.io-client';
    const details = ${JSON.stringify(details)}, bearer = ${JSON.stringify(bearer)};
    const status = document.querySelector('#status'), messages = document.querySelector('#messages');
    const room = new Room();
    const socket = io(${JSON.stringify(apiOrigin)}, { transports: ['websocket'], auth: { token: bearer } });
    let raised;
    socket.on('raise_response', message => { raised = message; document.querySelector('#raise-status').textContent = message.senderName + ' raised hand'; });
    const control = async (event, extra) => {
      if (!raised) return;
      const ack = await socket.timeout(8000).emitWithAck(event, { space: details.roomName, socketId: raised.senderSocketId, receiverId: raised.senderId, ...extra });
      document.querySelector('#raise-status').textContent = ack.ok ? 'Host action accepted' : ack.code;
    };
    document.querySelector('#accept-mic').onclick = () => control('raise_accept', {});
    document.querySelector('#invite-camera').onclick = () => control('invite_device', { device: 'camera', isOpen: true });
    document.querySelector('#mute-mic').onclick = () => control('control_participant', { type: 'mute_audio' });
    socket.on('chat_msg_response', m => { const p = document.createElement('p'); p.textContent = m.sender.name + ': ' + m.message; messages.append(p); });
    socket.on('connect', () => { document.querySelector('#chat-status').textContent = 'Chat connected'; });
    socket.on('disconnect', () => { document.querySelector('#chat-status').textContent = 'Chat reconnecting'; });
    socket.on('connect_error', error => { document.querySelector('#chat-status').textContent = error.message; });
    document.querySelector('#send').onclick = async () => {
      const input = document.querySelector('#message');
      if (!input.value.trim()) return;
      try { const ack = await socket.timeout(8000).emitWithAck('chat_msg', { id: crypto.randomUUID(), roomName: details.roomName, message: input.value, type: 'text', file: null });
        if (ack.ok) input.value = ''; else status.textContent = 'Chat failed';
      } catch { status.textContent = 'Chat timeout'; }
    };
    const members = () => document.querySelector('#members').textContent = 'RTC viewers: ' + room.remoteParticipants.size;
    room.on(RoomEvent.ParticipantConnected, members); room.on(RoomEvent.ParticipantDisconnected, members);
    document.querySelector('#publish').onclick = async () => {
      try {
        document.querySelector('#publish').disabled = true;
        const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
        function draw() { ctx.fillStyle = '#121212'; ctx.fillRect(0, 0, 640, 480); ctx.fillStyle = '#22CCEE'; ctx.font = '34px sans-serif'; ctx.fillText('VoceSpace Web → Native', 35, 150); ctx.fillText(new Date().toLocaleTimeString(), 120, 235); ctx.fillRect(Date.now() / 10 % 540, 310, 100, 30); requestAnimationFrame(draw); }
        draw();
        await room.connect(details.serverUrl, details.participantToken);
        await room.localParticipant.publishTrack(canvas.captureStream(15).getVideoTracks()[0], { source: Track.Source.Camera });
        const audio = new AudioContext(), oscillator = audio.createOscillator(), gain = audio.createGain(), destination = audio.createMediaStreamDestination();
        oscillator.frequency.value = 440; gain.gain.value = 0.015; oscillator.connect(gain); gain.connect(destination); oscillator.start(); await audio.resume();
        await room.localParticipant.publishTrack(destination.stream.getAudioTracks()[0], { source: Track.Source.Microphone });
        status.textContent = 'Publishing real WebRTC video + quiet test tone'; members();
      } catch (error) { status.textContent = String(error); document.querySelector('#publish').disabled = false; }
    };
  `;
  const bundle = await build({
    stdin: { contents: source, resolveDir: root, loader: 'js' },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    logLevel: 'silent',
  });
  const html = `<!doctype html><meta charset="utf-8"><title>VoceSpace isolated Native POC</title><style>body{background:#121212;color:white;font:18px sans-serif;padding:24px}button,input{padding:12px;margin:8px}button{background:#22CCEE;border:0}canvas{width:480px;max-width:100%;display:block}</style><h1>Isolated Web publisher</h1><p id="status">Ready</p><p id="members">RTC viewers: 0</p><p id="chat-status">Chat connecting</p><button id="publish">Publish test video and tone</button><canvas width="640" height="480"></canvas><input id="message" aria-label="Web message" value="Hello from Web"><button id="send">Send Web message</button><div id="messages"></div><p id="raise-status">Waiting for Native raised hand</p><button id="accept-mic">Invite microphone</button><button id="invite-camera">Invite camera</button><button id="mute-mic">Revoke microphone</button><script src="/poc.js"></script>`;
  web = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Type',
      req.url === '/poc.js' ? 'text/javascript' : 'text/html; charset=utf-8',
    );
    res.end(req.url === '/poc.js' ? bundle.outputFiles[0].contents : html);
  });
  await new Promise((resolve) => web.listen(webPort, '127.0.0.1', resolve));
  const state = { directory, apiOrigin, webOrigin, roomName };
  if (process.env.POC_STATE_FILE)
    await writeFile(process.env.POC_STATE_FILE, JSON.stringify(state));
  console.log(JSON.stringify(state));
  console.log(
    'Use the API URL for a simulator development build. Loopback only; not a physical-device setup. Ctrl-C cleans disposable services/data.',
  );
} catch (error) {
  console.error(error);
  await stop();
  process.exitCode = 1;
}
