import { startRealtime } from './realtime/server';
import { startWorker } from './worker/index';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { ApiRequest } from './http';
import { dispatch } from './dispatch';

const maxBytes = Number(process.env.API_UPLOAD_LIMIT_BYTES || 110 * 1024 * 1024);
const server = createServer(async (req, res) => {
  const abort = new AbortController();
  req.on('aborted', () => abort.abort());
  res.on('close', () => { if (!res.writableEnded) abort.abort(); });
  try {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > (req.url?.split('?')[0].includes('/account/') ? 20_000 : maxBytes)) { res.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
    const publicUrl = process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    const request = new ApiRequest(new URL(req.url || '/', publicUrl), {
      method: req.method, headers, signal: abort.signal,
      body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : Buffer.concat(chunks),
    });
    const response = await dispatch(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body && req.method !== 'HEAD') Readable.fromWeb(response.body as never).pipe(res);
    else res.end();
  } catch { if (!res.headersSent) res.writeHead(400); res.end(); }
});
const io = startRealtime(server);
const stopWorker = process.env.WORKER_ENABLED === 'false' ? () => {} : startWorker();
server.requestTimeout = 120_000;
server.headersTimeout = 30_000;
server.listen(Number(process.env.API_PORT || 3001), process.env.API_HOST || '127.0.0.1', () => {
  console.log('VoceSpace API ready');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stopWorker(); io.close(); server.close(() => process.exit(0)); });
