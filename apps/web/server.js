import dotenv from 'dotenv';
import next from 'next';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(webRoot, '../..');

// App-specific environment wins; root env remains a migration compatibility input.
for (const directory of [webRoot, repositoryRoot]) {
  for (const name of ['.env.local', `.env.${process.env.NODE_ENV || 'development'}`, '.env']) {
    dotenv.config({ path: path.join(directory, name) });
  }
}
process.chdir(webRoot);
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = Number(process.env.PORT || 3000);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const apiUrl = new URL(process.env.VOCESPACE_API_URL || 'http://127.0.0.1:3001');
const app = next({ dev, hostname, port, dir: webRoot });
await app.prepare();
const nextHandler = app.getRequestHandler();
const transport = apiUrl.protocol === 'https:' ? httpsRequest : httpRequest;
function proxy(req, res) {
  const upstream = transport(new URL(req.url, apiUrl), {
    method: req.method, headers: { ...req.headers }, timeout: 120_000,
  }, (response) => { res.writeHead(response.statusCode || 502, response.headers); response.pipe(res); });
  upstream.on('timeout', () => upstream.destroy());
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(503); res.end(); });
  req.on('aborted', () => upstream.destroy());
  res.on('close', () => upstream.destroy());
  req.pipe(upstream);
}
const server = createServer((req, res) => {
  if ([`${basePath}/api/`, `${basePath}/socket.io`, `${basePath}/uploads/`].some((prefix) => req.url?.startsWith(prefix))) return proxy(req, res);
  return nextHandler(req, res);
});
server.on('upgrade', (req, socket, head) => {
  if (!req.url?.startsWith(`${basePath}/socket.io`)) return app.getUpgradeHandler()(req, socket, head);
  const upstream = transport(new URL(req.url, apiUrl), { headers: { ...req.headers } });
  upstream.on('upgrade', (response, peer, initial) => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(response.headers).map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n\r\n`);
    if (head.length) peer.write(head);
    if (initial.length) socket.write(initial);
    peer.pipe(socket).pipe(peer);
    socket.on('error', () => peer.destroy());
    peer.on('error', () => socket.destroy());
    socket.on('close', () => peer.destroy());
  });
  upstream.on('error', () => socket.destroy());
  upstream.end();
});
server.requestTimeout = 120_000;
server.listen(port, hostname, () => console.log(`> Ready on http://${hostname}:${port}${basePath}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(() => process.exit(0));
});
