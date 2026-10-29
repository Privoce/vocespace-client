import { getConfig } from './lib/server/config';
import { ACCOUNT_AVATAR_MAX_BYTES } from '@vocespace/contracts';
import { startRealtime } from './realtime/server';
import { startWorker } from './worker/index';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { ApiRequest } from './http';
import { dispatch } from './dispatch';

const maxBytes = getConfig().deployment.api.uploadLimitBytes;
const server = createServer(async (req, res) => {
  const abort = new AbortController();
  req.on('aborted', () => abort.abort());
  res.on('close', () => { if (!res.writableEnded) abort.abort(); });
  try {
    const chunks: Buffer[] = [];
    let bytes = 0;
    const pathname = req.url?.split('?')[0] || '';
    const bodyLimit = /\/api\/(?:v1\/)?account\/avatar$/.test(pathname)
      ? Math.min(maxBytes, ACCOUNT_AVATAR_MAX_BYTES + 64 * 1024)
      : pathname.includes('/account/') ? 20_000 : maxBytes;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > bodyLimit) { res.writeHead(413, { Connection: 'close' }).end(); return; }
      chunks.push(chunk);
    }
    const publicUrl = getConfig().deployment.publicOrigin;
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
const stopWorker = !getConfig().deployment.api.workerEnabled ? () => {} : startWorker();
server.requestTimeout = 120_000;
server.headersTimeout = 30_000;
server.listen(getConfig().deployment.api.port, getConfig().deployment.api.host, () => {
  console.log('VoceSpace API ready');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stopWorker(); io.close(); server.close(() => process.exit(0)); });
