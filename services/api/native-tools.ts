import { accountFlows } from './account/flow-store';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { parseJoinId } from '@vocespace/contracts';
import { ApiRequest, ApiResponse } from './http';
import { AccessError, safeSegment } from './access';
import { requireNative } from './native-auth';
import { requireNativeChatMember } from './lib/server/native-chat';
import { getSpaceRedisClient } from './lib/server/space-redis';
import { getConfig } from './lib/server/config';
import { POST as upload } from './handlers/upload';

export async function nativeToolsEndpoint(request: ApiRequest) {
  if (request.method !== 'POST') throw new AccessError(405, 'METHOD_NOT_ALLOWED');
  const headers = new Headers(request.headers);
  headers.set('content-type', 'application/json');
  const authRequest = new ApiRequest(request.url, { headers });
  const { token, principal } = await requireNative(authRequest);
  const multipart = request.headers.get('content-type')?.startsWith('multipart/form-data');
  const form = multipart ? await request.formData() : undefined;
  const body = form ? Object.fromEntries(form) : await request.json();
  const joinId = parseJoinId(body);
  const access = await requireNativeChatMember(principal, joinId);
  if (!safeSegment(access.spaceName) || !safeSegment(access.roomName))
    throw new AccessError(400, 'INVALID_SPACE');
  if (!(await accountFlows.allow(`native-tools:${principal.id}`, 180)))
    throw new AccessError(429, 'RATE_LIMITED');
  const room = access.roomName === access.spaceName ? undefined : access.roomName;
  const dir = path.join(process.cwd(), 'uploads', access.spaceName, room || '');
  const list = async (): Promise<
    Array<{ id: string; ownerId: string; mode: string; fileName?: string; iframeUrl?: string }>
  > => {
    try {
      return JSON.parse(await readFile(path.join(dir, 'tile_players.json'), 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  };
  if (body.action === 'whiteboard') {
    const target = (await list()).find(
      (item) => item.id === body.playerId && item.mode === 'whiteboard',
    );
    if (!target) throw new AccessError(404, 'TOOL_NOT_FOUND');
    const drawing = body.handWriting;
    if (
      !drawing ||
      !Array.isArray(drawing.strokes) ||
      drawing.strokes.length > 200 ||
      JSON.stringify(drawing).length > 100000
    )
      throw new AccessError(400, 'INVALID_DRAWING');
    const strokes = drawing.strokes.map((stroke: Record<string, unknown>) => {
      if (
        !stroke ||
        typeof stroke !== 'object' ||
        typeof stroke.id !== 'string' ||
        stroke.id.length > 100 ||
        typeof stroke.color !== 'string' ||
        !/^#[0-9a-fA-F]{6}$/.test(stroke.color) ||
        !Array.isArray(stroke.points) ||
        stroke.points.length > 2000
      )
        throw new AccessError(400, 'INVALID_DRAWING');
      const points = stroke.points.map((point: { x?: unknown; y?: unknown }) => {
        if (
          !point ||
          typeof point.x !== 'number' ||
          typeof point.y !== 'number' ||
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y) ||
          point.x < 0 ||
          point.x > 1 ||
          point.y < 0 ||
          point.y > 1
        )
          throw new AccessError(400, 'INVALID_DRAWING');
        return { x: point.x, y: point.y };
      });
      return {
        id: stroke.id,
        color: stroke.color,
        tool: 'pen',
        width: 3,
        createdAt: Date.now(),
        points,
      };
    });
    await requireNativeChatMember((await requireNative(authRequest)).principal, joinId);
    globalThis.vocespaceSocketServer
      ?.to(`space:${access.spaceName}`)
      .emit('whiteboard_sync_response', {
        space: access.spaceName,
        senderId: access.identity,
        receiverId: target.id,
        handWriting: { strokes, undoneStrokes: [] },
      });
    return ApiResponse.json({ success: true });
  }
  if (body.action !== 'ls') {
    if (!['upload', 'set_meta', 'create_hyperbeam', 'create_whiteboard'].includes(body.action))
      throw new AccessError(400, 'INVALID_TOOL_ACTION');
    let payload: FormData | string;
    if (body.action === 'upload') {
      const file = form?.get('file');
      if (
        !(file instanceof File) ||
        !/^image\/(png|jpeg|webp|gif)$/.test(file.type) ||
        file.size > 10 * 1024 * 1024
      )
        throw new AccessError(400, 'INVALID_IMAGE');
      const data = new FormData();
      data.set('file', file);
      data.set('spaceName', access.spaceName);
      data.set('identity', access.identity);
      data.set('ty', 'upload');
      if (room) data.set('room', room);
      headers.delete('content-type');
      payload = data;
    } else {
      if (body.action === 'set_meta') {
        let url: URL;
        try {
          url = new URL(body.url);
        } catch {
          throw new AccessError(400, 'INVALID_URL');
        }
        if (url.protocol !== 'https:' || url.username || url.password)
          throw new AccessError(400, 'INVALID_URL');
      }
      payload = JSON.stringify({
        ty: body.action,
        spaceName: access.spaceName,
        room,
        identity: access.identity,
        iframeUrl: body.url,
      });
    }
    const response = await upload(
      new ApiRequest(new URL('/api/upload?tilePlayer=true', request.url), {
        method: 'POST',
        headers,
        body: payload,
      }),
    );
    if (!response.ok) return response;
    await requireNativeChatMember((await requireNative(authRequest)).principal, joinId);
    globalThis.vocespaceSocketServer
      ?.to(`space:${access.spaceName}`)
      .emit('tile_player_change_response', {
        space: access.spaceName,
        action: 'create',
        created: true,
      });
  }
  const items = await list();
  const redis = getSpaceRedisClient();
  if (!redis) throw new AccessError(503, 'STORAGE_UNAVAILABLE');
  const players = await Promise.all(
    items.map(async (item) => {
      let url: string | undefined;
      if (item.mode === 'image' && safeSegment(item.fileName)) {
        const id = randomBytes(32).toString('hex');
        await redis.set(
          `v1:native-file:${id}`,
          JSON.stringify({
            token,
            joinId,
            space: access.spaceName,
            room,
            name: item.fileName,
            image: true,
          }),
          'EX',
          120,
        );
        url = new URL(
          `${getConfig().deployment.basePath}/api/v1/native/files/${id}`,
          getConfig().deployment.publicOrigin,
        ).toString();
      }
      return {
        id: item.id,
        mode: item.mode,
        ownerId: item.ownerId,
        url: url || item.iframeUrl || undefined,
      };
    }),
  );
  await requireNativeChatMember((await requireNative(authRequest)).principal, joinId);
  return ApiResponse.json({ players });
}
