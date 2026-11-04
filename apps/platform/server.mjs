import { configPath, setConfigPath, readConfiguration } from '@vocespace/config-node';
import next from 'next';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

setConfigPath(configPath());
const directory = path.dirname(fileURLToPath(import.meta.url));
const config = readConfiguration().deployment.platform;
// Next resolves server externals from cwd; keep the legacy UI's dependencies isolated.
process.chdir(directory);
const upstream = new URL(config.apiUrl);
const transport = upstream.protocol === 'https:' ? httpsRequest : httpRequest;
const app = next({ dir: directory, dev: process.env.NODE_ENV !== 'production', hostname: config.host, port: config.port });
await app.prepare();
const handle = app.getRequestHandler();
const server = createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ status: 'ok', service: 'platform' }));
  }
  // Only platform API routes are forwarded; auth callbacks stay in Next.
  if (req.url?.split('?')[0].startsWith('/api/platform/')) {
    const target = new URL(req.url, upstream);
    const request = transport(target, { method: req.method, headers: { ...req.headers }, timeout: 30000 }, response => {
      res.writeHead(response.statusCode || 502, response.headers); response.pipe(res);
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => { if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"code":"API_UNAVAILABLE"}'); });
    req.on('aborted', () => request.destroy());
    res.on('close', () => request.destroy());
    return req.pipe(request);
  }
  handle(req, res);
});
server.listen(config.port, config.host, () => console.log(`VoceSpace Platform ready on ${config.host}:${config.port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
