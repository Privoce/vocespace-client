import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile, unlink, lstat } from 'node:fs/promises';
import path from 'node:path';
import { parseJoinId } from '@vocespace/contracts';
import { ApiRequest, ApiResponse } from './http';
import { AccessError, safeSegment } from './access';
import { requireNative } from './native-auth';
import { requireNativeChatMember } from './lib/server/native-chat';
import { getSpaceRedisClient } from './lib/server/space-redis';
import { spaceRepository } from './lib/server/space-repository';
import { sessions } from './lib/server/sessions';
import { getConfig } from './lib/server/config';

const writes = new Map<string, Promise<unknown>>();
async function serialize<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = writes.get(key);
  const result = (async () => {
    await previous?.catch(() => undefined);
    return action();
  })();
  writes.set(key, result);
  try {
    return await result;
  } finally {
    if (writes.get(key) === result) writes.delete(key);
  }
}

const fileKey = (id: string) => `v1:native-file:${id}`;
const storage = () => {
  const redis = getSpaceRedisClient();
  if (!redis) throw new AccessError(503, 'STORAGE_UNAVAILABLE');
  return redis;
};
const directory = (space: string) => path.join(process.cwd(), 'uploads', space);
const downloadable = (name: unknown): name is string =>
  safeSegment(name) && name !== 'tile_players.json';

/** Short-lived download capability, still bound to live session and confirmed membership. */
export async function nativeFileDownload(request: ApiRequest, id: string) {
  if (request.method !== 'GET') throw new AccessError(405, 'METHOD_NOT_ALLOWED');
  const raw = await storage().get(fileKey(id));
  if (!raw) throw new AccessError(410, 'FILE_LINK_EXPIRED');
  const entry = JSON.parse(raw) as {
    token: string;
    joinId: string;
    space: string;
    name: string;
    room?: string;
    image?: boolean;
  };
  const check = async () => {
    const principal = await sessions.read(entry.token);
    if (!principal || principal.client !== 'native') throw new AccessError(403, 'SESSION_REQUIRED');
    const access = await requireNativeChatMember(principal, entry.joinId);
    if (
      (entry.room && !safeSegment(entry.room)) ||
      (entry.image && access.roomName !== (entry.room || entry.space))
    )
      throw new AccessError(403, 'FILE_ACCESS_DENIED');
    if (access.spaceName !== entry.space || !downloadable(entry.name))
      throw new AccessError(403, 'FILE_ACCESS_DENIED');
  };
  await check();
  const target = path.join(directory(entry.space), entry.room || '', entry.name);
  const stat = await lstat(target).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) throw new AccessError(404, 'FILE_NOT_FOUND');
  const bytes = await readFile(target);
  await check();
  return new ApiResponse(bytes, {
    headers: {
      'Content-Type': entry.image
        ? {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
          }[path.extname(entry.name).toLowerCase()] || 'application/octet-stream'
        : 'application/octet-stream',
      'Content-Disposition': `${entry.image ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(entry.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function nativeFilesEndpoint(request: ApiRequest) {
  if (request.method !== 'POST') throw new AccessError(405, 'METHOD_NOT_ALLOWED');
  const multipart = request.headers.get('content-type')?.startsWith('multipart/form-data');
  const headers = new Headers(request.headers);
  headers.set('content-type', 'application/json');
  const authRequest = new ApiRequest(request.url, { headers });
  const { token } = await requireNative(authRequest);
  const form = multipart ? await request.formData() : undefined;
  const body = form ? Object.fromEntries(form) : await request.json();
  const joinId = parseJoinId(body);
  const check = async () =>
    requireNativeChatMember((await requireNative(authRequest)).principal, joinId);
  const access = await check();
  if (body.action === 'list' && !multipart) {
    const entries = await readdir(directory(access.spaceName), { withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      },
    );
    await check();
    return ApiResponse.json({
      files: entries
        .filter((item) => item.isFile() && downloadable(item.name))
        .map((item) => item.name),
    });
  }
  if (body.action === 'download' && !multipart) {
    if (!downloadable(body.name)) throw new AccessError(400, 'INVALID_FILE');
    const id = randomBytes(32).toString('hex');
    await storage().set(
      fileKey(id),
      JSON.stringify({ token, joinId, space: access.spaceName, name: body.name }),
      'EX',
      120,
    );
    const url = new URL(
      `${getConfig().deployment.basePath}/api/v1/native/files/${id}`,
      getConfig().deployment.publicOrigin,
    );
    return ApiResponse.json({ url: url.toString() });
  }
  if (body.action !== 'upload' || !form) throw new AccessError(400, 'INVALID_FILE_ACTION');
  const file = form.get('file');
  const id = body.id;
  if (!(file instanceof File) || typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
    throw new AccessError(400, 'INVALID_FILE');
  if (file.size > 100 * 1024 * 1024) throw new AccessError(413, 'FILE_TOO_LARGE');
  const ext = path
    .extname(file.name)
    .replace(/[^.a-zA-Z0-9]/g, '')
    .slice(0, 16);
  const name = `${access.identity}_${id}${ext}`;
  const redis = storage();
  const dedup = `v1:message:${access.spaceName}:${access.identity}:${id}`;
  return serialize(dedup, async () => {
    await check();
    if (await redis.exists(dedup)) return ApiResponse.json({ success: true, id });
    const dir = directory(access.spaceName);
    await mkdir(dir, { recursive: true });
    const target = path.join(dir, name);
    await writeFile(target, Buffer.from(await file.arrayBuffer()));
    try {
      await check();
      const space = await spaceRepository.get(access.spaceName);
      const msg = {
        id,
        roomName: access.roomName,
        sender: { id: access.identity, name: space!.participants[access.identity].name },
        timestamp: Date.now(),
        type: 'file',
        message: null,
        file: {
          name: file.name.slice(0, 200),
          size: file.size,
          type: file.type,
          url: `${getConfig().deployment.basePath}/uploads/${encodeURIComponent(access.spaceName)}/${encodeURIComponent(name)}`,
        },
      };
      const stored = await redis.eval(
        `if redis.call('EXISTS',KEYS[2])==1 then return 0 end
      local raw=redis.call('GET',KEYS[1]); local list=raw and cjson.decode(raw) or {}
      table.insert(list,cjson.decode(ARGV[1])); redis.call('SET',KEYS[1],cjson.encode(list))
      redis.call('SET',KEYS[2],'1','EX',86400); return 1`,
        2,
        `chat:${access.spaceName}`,
        dedup,
        JSON.stringify(msg),
      );
      if (stored)
        globalThis.vocespaceSocketServer
          ?.to(`space:${access.spaceName}`)
          .emit('chat_file_response', msg);
      return ApiResponse.json({ success: true, id });
    } catch (error) {
      // Preserve committed data if the response is lost; the same message ID is safe to retry.
      if (!(await redis.exists(dedup))) await unlink(target).catch(() => undefined);
      throw error;
    }
  });
}
