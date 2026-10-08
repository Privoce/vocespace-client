import { removeMediaMember } from '@/lib/server/media-members';
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { sessions, sessionToken } from '@/lib/server/sessions';
import { getSpaceRedisClient } from '@/lib/server/space-redis';
import { membership, safeSegment } from '../api/access';

export const eventPolicy = {
  wave: 'target', raise: 'broadcast', raise_accept: 'manageTarget', raise_cancel: 'target',
  remove_participant: 'manageTarget', invite_device: 'manageTarget', req_record: 'target',
  recording: 'manageBroadcast', control_participant: 'manageTarget',
  update_user_status: 'all', refetch_room: 'all', mouse_move: 'broadcast', mouse_click: 'broadcast',
  mouse_remove: 'broadcast', whiteboard_sync: 'broadcast', whiteboard_clear_all: 'manageBroadcast',
  chat_msg: 'chat', chat_file: 'file', reload_virtual: 'broadcast', clear_space_resources: 'manageAll',
  new_user_status: 'all', join_privacy_room: 'manageTarget', removed_from_privacy_room: 'manageTargets',
  reload_env: 'manageAll', re_init: 'manageAll', tile_player_change: 'all',
} as const;

export function startRealtime(server: HttpServer) {
  const io = new Server(server, { maxHttpBufferSize: 1024 * 1024,
    path: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/socket.io`,
    allowRequest(req, done) {
      const origin = req.headers.origin;
      const allowed = process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
      done(null, !origin || origin === allowed);
    },
  });
  globalThis.vocespaceSocketServer = io;
  io.use(async (socket, next) => {
    try {
      const headers = new Headers();
      if (socket.handshake.headers.cookie) headers.set('cookie', socket.handshake.headers.cookie);
      if (typeof socket.handshake.auth.token === 'string') headers.set('authorization', `Bearer ${socket.handshake.auth.token}`);
      const token = sessionToken(headers);
      const principal = await sessions.read(token);
      if (!principal) return next(new Error('SESSION_REQUIRED'));
      socket.data.token = token; socket.data.sessionId = principal.id;
      for (const space of Object.keys(principal.identities)) {
        try { const member = await membership(principal, space); if (member.participant) await socket.join(`space:${space}`); }
        catch { /* A session may outlive one of its room memberships. */ }
      }
      next();
    } catch { next(new Error('AUTH_UNAVAILABLE')); }
  });
  io.on('connection', (socket) => {
    for (const [event, policy] of Object.entries(eventPolicy)) {
      socket.on(event, async (payload: unknown, ack?: (value: unknown) => void) => {
        const reply = (value: unknown) => { if (typeof ack === 'function') ack(value); };
        try {
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('INVALID_EVENT');
          const msg = { ...(payload as Record<string, any>) };
          const space = msg.space || msg.roomName || msg.spaceName || msg.room;
          if (!safeSegment(space)) throw new Error('INVALID_SPACE');
          const current = await sessions.read(socket.data.token);
          if (!current) { for (const room of socket.rooms) if (room !== socket.id) socket.leave(room); throw new Error('SESSION_REVOKED'); }
          const member = await membership(current, space);
          if (!member.participant) { socket.leave(`space:${space}`); throw new Error('MEMBERSHIP_REVOKED'); }
          if (policy.startsWith('manage') && !member.manager) throw new Error('MANAGER_REQUIRED');
          await socket.join(`space:${space}`);
          if (msg.senderId) msg.senderId = member.id;
          if (msg.sender) msg.sender = { id: member.id, name: member.participant.name };
          // Revalidate recipients too: revoked sessions must not keep reading a joined channel.
          for (const peer of io.sockets.sockets.values()) {
            if (!peer.rooms.has(`space:${space}`)) continue;
            const reader = await sessions.read(peer.data.token);
            const readerId = reader?.identities[space];
            if (!readerId || !member.info.participants[readerId]) peer.leave(`space:${space}`);
          }
          const response = event === 'update_user_status' ? 'user_status_updated' : `${event}_response`;
          if (policy.toLowerCase().includes('target')) {
            const ids = policy === 'manageTargets' ? msg.socketIds : [msg.socketId];
            if (!Array.isArray(ids)) throw new Error('INVALID_TARGET');
            for (const id of ids) {
              const target = io.sockets.sockets.get(id);
              const targetPrincipal = target && await sessions.read(target.data.token);
              if (!targetPrincipal) throw new Error('TARGET_UNAVAILABLE');
              const targetMember = await membership(targetPrincipal, space);
              if (!targetMember.participant) throw new Error('TARGET_NOT_IN_SPACE');
              if (event === 'remove_participant') await removeMediaMember(space, targetMember.id);
            }
            for (const id of ids) io.to(id).emit(response, msg);
          } else if (policy === 'chat' || policy === 'file') {
            if (policy === 'file' && (!msg.file?.url || msg.file?.data)) throw new Error('UPLOAD_HTTP_REQUIRED');
            const redis = getSpaceRedisClient();
            if (!redis) throw new Error('STORAGE_UNAVAILABLE');
            const id = typeof msg.id === 'string' && msg.id.length <= 100 ? msg.id : randomUUID();
            msg.id = id; msg.sender = { id: member.id, name: member.participant.name }; msg.timestamp = Date.now();
            // Atomic append + dedup keeps the legacy JSON array key, including across reconnects.
            const stored = await redis.eval(`if redis.call('EXISTS',KEYS[2])==1 then return 0 end
              local raw=redis.call('GET',KEYS[1]); local list=raw and cjson.decode(raw) or {}
              table.insert(list,cjson.decode(ARGV[1])); redis.call('SET',KEYS[1],cjson.encode(list))
              redis.call('SET',KEYS[2],'1','EX',86400); return 1`, 2,
              `chat:${space}`, `v1:message:${space}:${member.id}:${id}`, JSON.stringify(msg));
            if (stored) io.to(`space:${space}`).emit(response, msg);
            reply({ ok: true, id, duplicate: !stored }); return;
          } else {
            // Resource deletion is owned by HTTP services / worker; this event is notification-only.
            if (policy.toLowerCase().includes('broadcast')) socket.to(`space:${space}`).emit(response, msg);
            else io.to(`space:${space}`).emit(response, msg);
          }
          reply({ ok: true });
        } catch (error) { reply({ ok: false, code: error instanceof Error ? error.message : 'EVENT_FAILED' }); }
      });
    }
    // Socket reconnects do not remove RTC members. The worker reconciles against LiveKit.
  });
  return io;
}
