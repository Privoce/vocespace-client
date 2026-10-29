import { runtimeAssetPath } from './runtime-paths';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { previewAssetName, rewritePreviewPlaylist } from '@vocespace/server-core';
import { sessions } from './lib/server/sessions';
import { AccessError, safeSegment } from './access';
import { requireNative } from './native-auth';
import { ApiRequest, ApiResponse } from './http';
import {
  ensurePreview,
  previewObject,
  previewRedis,
  readJob,
  rendererDetails,
  touchJob,
  validJob,
} from './preview/source';

const LEASE_SECONDS = 120;
interface Lease {
  job: string;
  session: string;
  sessionId: string;
}
const leaseKey = (id: string) => `v1:preview:lease:${id}`;
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id);
const response = (body: unknown) =>
  ApiResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
async function lease(id: string) {
  if (!validId(id)) throw new AccessError(404, 'PREVIEW_UNAVAILABLE');
  const raw = await previewRedis().get(leaseKey(id));
  if (!raw) throw new AccessError(410, 'PREVIEW_EXPIRED');
  return JSON.parse(raw) as Lease;
}
export async function nativePreviewEndpoint(request: ApiRequest) {
  const { token, principal } = await requireNative(request);
  if (!['POST', 'PUT', 'DELETE'].includes(request.method))
    return new ApiResponse(null, { status: 405 });
  const body = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new AccessError(400, 'INVALID_REQUEST');
  if (request.method !== 'POST') {
    if (!validId(body.leaseId)) throw new AccessError(400, 'INVALID_PREVIEW_LEASE');
    const raw = await previewRedis().get(leaseKey(body.leaseId));
    if (!raw && request.method === 'DELETE') return response({ success: true });
    const current = await lease(body.leaseId);
    if (current.sessionId !== principal.id) throw new AccessError(403, 'PREVIEW_ACCESS_DENIED');
    if (request.method === 'DELETE') await previewRedis().del(leaseKey(body.leaseId));
    else {
      const job = await readJob(current.job);
      if (!job || !(await validJob(job))) throw new AccessError(410, 'PREVIEW_EXPIRED');
      await previewRedis().expire(leaseKey(body.leaseId), LEASE_SECONDS);
      await previewRedis().expire(`v1:preview:session:${principal.id}`, LEASE_SECONDS);
    }
    return response({ success: true });
  }
  if (!safeSegment(body.spaceName)) throw new AccessError(400, 'INVALID_SPACE');
  const requestStamp = randomBytes(16).toString('hex');
  const requestKey = `v1:preview:request:${principal.id}`;
  await previewRedis().set(requestKey, requestStamp, 'EX', LEASE_SECONDS);
  // A request can start one shared source; no business member, invitation, Socket or RTC token is issued to this viewer.
  const job = await ensurePreview(body.spaceName);
  if (!job) return response({ status: 'unavailable' });
  try {
    const playlist = await previewObject(job, 'live.m3u8');
    if (!new TextDecoder().decode(playlist).includes('#EXTINF:'))
      return response({ status: 'starting' });
  } catch {
    return response({ status: 'starting' });
  }
  if (!(await validJob(job))) return response({ status: 'starting' });
  // One active lease per Native session; switching pages revokes the previous playback capability.
  const previousKey = `v1:preview:session:${principal.id}`;
  const id = randomBytes(32).toString('hex');
  const saved = await previewRedis().eval(
    `
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
    local old = redis.call('GET', KEYS[2])
    if old then redis.call('DEL', 'v1:preview:lease:' .. old) end
    redis.call('SET', KEYS[3], ARGV[2], 'EX', ARGV[3])
    redis.call('SET', KEYS[2], ARGV[4], 'EX', ARGV[3])
    return 1`,
    3,
    requestKey,
    previousKey,
    leaseKey(id),
    requestStamp,
    JSON.stringify({ job: job.id, session: token, sessionId: principal.id } satisfies Lease),
    LEASE_SECONDS,
    id,
  );
  if (saved !== 1) throw new AccessError(409, 'PREVIEW_SUPERSEDED');
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/native\/preview$/, `preview/media/${id}/live.m3u8`);
  url.search = '';
  return response({
    status: 'ready',
    leaseId: id,
    url: url.toString(),
    expiresAt: Date.now() + LEASE_SECONDS * 1000,
  });
}
export async function previewMediaEndpoint(request: ApiRequest, id: string, name: string) {
  if (request.method !== 'GET') return new ApiResponse(null, { status: 405 });
  if (!previewAssetName(name)) throw new AccessError(400, 'INVALID_PREVIEW_ASSET');
  const access = await lease(id);
  const check = async () => {
    const principal = await sessions.read(access.session);
    const job = await readJob(access.job);
    if (
      !principal ||
      principal.client !== 'native' ||
      principal.id !== access.sessionId ||
      !(await previewRedis().exists(leaseKey(id))) ||
      !job ||
      !(await validJob(job))
    )
      throw new AccessError(410, 'PREVIEW_EXPIRED');
    return job;
  };
  const job = await check();
  let bytes: Uint8Array;
  try {
    bytes = await previewObject(job, name);
  } catch {
    throw new AccessError(503, 'PREVIEW_BUFFERING');
  }
  await check(); // Recheck after object I/O; a Room move/revocation must not release a stale segment.
  await touchJob(job.id);
  const playlist = name.endsWith('.m3u8');
  const body = playlist
    ? rewritePreviewPlaylist(new TextDecoder().decode(bytes), (asset) => asset)
    : Buffer.from(bytes);
  return new ApiResponse(body, {
    headers: {
      'Content-Type': playlist
        ? 'application/vnd.apple.mpegurl'
        : name.endsWith('.ts')
          ? 'video/mp2t'
          : 'video/mp4',
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export async function previewRendererEndpoint(
  request: ApiRequest,
  kind: 'render' | 'details' | 'script',
) {
  if (request.method !== 'GET') return new ApiResponse(null, { status: 405 });
  if (kind === 'script') {
    const asset = path.join(
      runtimeAssetPath('preview'),
      'renderer.js',
    );
    return new ApiResponse(await readFile(asset), {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
  const id = request.nextUrl.searchParams.get('job');
  const key = request.nextUrl.searchParams.get('key');
  if (!id || !/^[a-f0-9-]{36}$/.test(id) || !validId(key))
    throw new AccessError(404, 'PREVIEW_UNAVAILABLE');
  const job = await readJob(id);
  if (!job || !timingSafeEqual(Buffer.from(job.key), Buffer.from(key)) || !(await validJob(job)))
    throw new AccessError(410, 'PREVIEW_EXPIRED');
  if (kind === 'details') return response(await rendererDetails(job));
  return new ApiResponse(
    `<!doctype html><html><head><meta name="referrer" content="no-referrer"><style>
    *{box-sizing:border-box}body{margin:0;background:#0b1016;color:#fff;font:24px sans-serif}main{height:100vh;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:12px}
    section{position:relative;min-height:0;background:#202020;border-radius:20px;overflow:hidden;display:flex;align-items:center;justify-content:center}video{width:100%;height:100%;object-fit:contain}label{position:absolute;bottom:16px;left:16px;background:#111b;padding:6px;border-radius:8px}span{color:#22ccee;font-size:60px}
    </style></head><body><main id="tiles"></main><script src="./script"></script></body></html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    },
  );
}
