import { getConfig } from '../lib/server/config';
import { setNativeHand } from '../lib/server/native-hand';
import { bindNativeSocket, inviteNativeMedia, revokeNativeMedia } from '../lib/server/native-media';
import { removeMediaMember } from '../lib/server/media-members';
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { sessions, sessionToken } from '../lib/server/sessions';
import { getSpaceRedisClient } from '../lib/server/space-redis';
import { AccessError, membership, safeSegment } from '../access';
import { ContractError, parseJoinId, parseNativeChatRequest } from '@vocespace/contracts';
import { requireNativeChatMember } from '../lib/server/native-chat';

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
    path: `${getConfig().deployment.basePath}/socket.io`,
    allowRequest(req, done) {
      const origin = req.headers.origin;
      const allowed = getConfig().deployment.publicOrigin;
      const nativeTransport = req.headers['x-vocespace-client'] === 'native' &&
        req.headers.upgrade?.toLowerCase() === 'websocket';
      // This marker only selects a transport. Middleware still requires a Native Bearer session
      // and a confirmed join, and never falls back to browser Cookie authorization.
      done(null, nativeTransport || !origin || origin === allowed);
    },
  });
  globalThis.vocespaceSocketServer = io;
  io.use(async (socket, next) => {
    try {
      const headers = new Headers();
      const nativeTransport = socket.handshake.headers['x-vocespace-client'] === 'native';
      if (!nativeTransport && socket.handshake.headers.cookie) headers.set('cookie', socket.handshake.headers.cookie);
      if (typeof socket.handshake.auth.token === 'string') headers.set('authorization', `Bearer ${socket.handshake.auth.token}`);
      const token = sessionToken(headers);
      const principal = await sessions.read(token);
      if (!principal) return next(new Error('SESSION_REQUIRED'));
      if (nativeTransport && principal.client !== 'native') return next(new Error('NATIVE_SESSION_REQUIRED'));
      if (principal.client === 'native' && !nativeTransport) return next(new Error('NATIVE_TRANSPORT_REQUIRED'));
      socket.data.token = token; socket.data.sessionId = principal.id;
      if (principal.client === 'native') {
        const joinId = parseJoinId(socket.handshake.auth);
        const access = await requireNativeChatMember(principal, joinId);
        await bindNativeSocket(principal, joinId, socket.id);
        socket.data.nativeJoinId = joinId;
        await socket.join(`space:${access.spaceName}`);
        return next();
      }
      for (const space of Object.keys(principal.identities)) {
        try { const member = await membership(principal, space); if (member.participant) await socket.join(`space:${space}`); }
        catch { /* A session may outlive one of its room memberships. */ }
      }
      next();
    } catch (error) { next(new Error(error instanceof AccessError ? error.code : 'AUTH_UNAVAILABLE')); }
  });
  io.on('connection', (socket) => {
    if (socket.data.nativeJoinId) for (const room of socket.rooms) {
      if (room.startsWith('space:')) io.to(room).emit('user_status_updated', { space: room.slice(6) });
    }
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
          if (current.client === 'native') {
            const access = await requireNativeChatMember(current, socket.data.nativeJoinId);
            if (access.spaceName !== space) throw new Error('SPACE_ACCESS_DENIED');
            if (!['chat_msg', 'chat_file', 'raise'].includes(event)) throw new Error('NATIVE_EVENT_UNSUPPORTED');
            if (event === 'chat_file') throw new Error('UPLOAD_HTTP_REQUIRED');
            if (event === 'chat_msg') {
              const input = parseNativeChatRequest(msg);
              if (input.joinId !== socket.data.nativeJoinId) throw new Error('CHAT_MEMBERSHIP_REQUIRED');
              // Canonical text only. Client-supplied fields cannot reach Web readers or storage.
              for (const key of Object.keys(msg)) delete msg[key];
              Object.assign(msg, { id: input.id, roomName: (await requireNativeChatMember(current, socket.data.nativeJoinId)).roomName, message: input.message, type: 'text', file: null });
            }
          }
          const member = await membership(current, space);
          if (!member.participant) { socket.leave(`space:${space}`); throw new Error('MEMBERSHIP_REVOKED'); }
          if (policy.startsWith('manage') && !member.manager) throw new Error('MANAGER_REQUIRED');
          await socket.join(`space:${space}`);
          if (msg.senderId) msg.senderId = member.id;
          let nativeHand: boolean | undefined;
          if (event === 'raise') {
            msg.senderId = member.id; msg.senderName = member.participant.name; msg.senderSocketId = socket.id;
            if (current.client === 'native') {
              if (msg.raised !== undefined && typeof msg.raised !== 'boolean') throw new Error('INVALID_EVENT');
              const raised = msg.raised !== false;
              await setNativeHand(current, socket.data.nativeJoinId, raised);
              nativeHand = raised;
            }
          }
          if (msg.sender) msg.sender = { id: member.id, name: member.participant.name };
          // Revalidate recipients too: revoked sessions must not keep reading a joined channel.
          for (const peer of io.sockets.sockets.values()) {
            if (!peer.rooms.has(`space:${space}`)) continue;
            const reader = await sessions.read(peer.data.token);
            const readerId = reader?.identities[space];
            if (!readerId || !member.info.participants[readerId]) peer.leave(`space:${space}`);
            else if (reader?.client === 'native') {
              try { await requireNativeChatMember(reader, peer.data.nativeJoinId); }
              catch { peer.leave(`space:${space}`); }
            }
          }
          if (nativeHand !== undefined) {
            io.to(`space:${space}`).emit('user_status_updated', { space });
            // Lowering updates the badge without notifying the host of a new request.
            if (!nativeHand) { reply({ ok: true }); return; }
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
              if (targetPrincipal.client === 'native' && ['invite_device', 'raise_accept', 'control_participant'].includes(event)) {
                await requireNativeChatMember(targetPrincipal, target!.data.nativeJoinId);
                const device = event === 'raise_accept' ? 'microphone' : event === 'control_participant'
                  ? ({ mute_audio: 'microphone', mute_video: 'camera', mute_screen: 'screen' } as const)[msg.type as 'mute_audio' | 'mute_video' | 'mute_screen'] : msg.device === 'screen_share' ? 'screen' : msg.device;
                if (device !== 'microphone' && device !== 'camera' && device !== 'screen') throw new Error('NATIVE_DEVICE_UNSUPPORTED');
                if (event === 'invite_device' && typeof msg.isOpen !== 'boolean') throw new Error('INVALID_EVENT');
                msg.receiverId = targetMember.id;
                msg.senderName = member.participant.name;
                if (event === 'raise_accept' || event === 'invite_device' && msg.isOpen) {
                  const invitation = await inviteNativeMedia(targetPrincipal, target!.data.nativeJoinId,
                    socket.data.token, member.participant.name, device);
                  io.to(id).emit('native_media_invitation', invitation);
                } else {
                  await revokeNativeMedia(targetPrincipal, target!.data.nativeJoinId, device);
                  io.to(id).emit('native_media_revoked', { device });
                }
              }
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
        } catch (error) { reply({ ok: false, code: error instanceof ContractError ? 'INVALID_EVENT' : error instanceof Error ? error.message : 'EVENT_FAILED' }); }
      });
    }
    // Socket reconnects do not remove RTC members. The worker reconciles against LiveKit.
  });
  return io;
}
