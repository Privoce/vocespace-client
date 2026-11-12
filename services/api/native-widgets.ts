import {
  parseJoinId,
  parseNativeWidgetAction,
  type NativeWidgetAction,
} from '@vocespace/contracts';
import { DEFAULT_TIMER, type SpaceInfo } from '@vocespace/domain/space';
import { StorageUnavailableError } from '@vocespace/server-core';
import { accountFlows } from './account/flow-store';
import { requireNativeChatMember } from './lib/server/native-chat';
import { spaceRepository } from './lib/server/space-repository';
import { getSpaceRedisClient } from './lib/server/space-redis';
import { requireNative } from './native-auth';
import { ApiRequest, ApiResponse } from './http';
import { AccessError } from './access';

const defaultCountdown = () => ({
  value: null,
  running: false,
  stopTimeStamp: null,
  duration: '1970-01-01T00:05:00',
  timestamp: Date.now(),
});
const format = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
export function widgetSnapshot(info: SpaceInfo, identity: string) {
  const member = info.participants[identity];
  if (!member) throw new AccessError(403, 'MEMBERSHIP_REQUIRED');
  return {
    name: member.name,
    enabled: info.apps,
    sync: member.sync || [],
    todo: (member.appDatas?.todo || []).map((group) => ({
      date: group.date,
      items: group.items.map((item) => ({ ...item, visible: item.visible !== false })),
    })),
    timer: member.appDatas?.timer || { ...DEFAULT_TIMER, records: [] },
    countdown: member.appDatas?.countdown || defaultCountdown(),
  };
}

/** Only the authenticated member's widgets can be changed; existing Redis shapes are retained. */
export function applyWidgetAction(
  info: SpaceInfo,
  identity: string,
  action: NativeWidgetAction,
  now: number,
) {
  const member = info.participants[identity];
  if (!member) throw new AccessError(403, 'MEMBERSHIP_REQUIRED');
  const key = 'key' in action ? action.key : action.kind === 'countdown-set' ? 'countdown' : 'todo';
  if (!info.apps.includes(key)) throw new AccessError(403, 'APP_DISABLED');
  member.appDatas ||= {};
  if (action.kind === 'sync') {
    member.sync = [
      ...new Set([
        ...(member.sync || []).filter((item) => item !== action.key),
        ...(action.visible ? [action.key] : []),
      ]),
    ];
    return;
  }
  if (action.kind.startsWith('todo-')) {
    if (!('id' in action)) return;
    const groups = (member.appDatas.todo ||= []);
    const group = groups.find((g) => g.items.some((item) => item.id === action.id));
    const item = group?.items.find((item) => item.id === action.id);
    if (action.kind === 'todo-add') {
      if (item) return;
      if (groups.reduce((n, g) => n + g.items.length, 0) >= 10000)
        throw new AccessError(409, 'TODO_LIMIT');
      const date = Math.floor(now / 86400000) * 86400000;
      const today = groups.find((g) => g.date === date) || { date, items: [] };
      if (!groups.includes(today)) groups.push(today);
      today.items.push({ id: action.id, title: action.title, visible: true });
    } else {
      if (!item || !group) throw new AccessError(404, 'TODO_NOT_FOUND');
      if (action.kind === 'todo-edit') item.title = action.title;
      if (action.kind === 'todo-done') {
        if (action.done) item.done ||= now;
        else delete item.done;
      }
      if (action.kind === 'todo-delete') {
        if (item.done) item.visible = false;
        else group.items = group.items.filter((value) => value.id !== action.id);
      }
    }
    return;
  }
  if (action.kind === 'countdown-set') {
    const clock = (member.appDatas.countdown ||= defaultCountdown());
    if (clock.running) throw new AccessError(409, 'CLOCK_RUNNING');
    Object.assign(clock, {
      duration: `1970-01-01T${format(action.seconds)}`,
      value: null,
      stopTimeStamp: null,
      timestamp: now,
    });
    return;
  }
  if (action.kind !== 'clock') return;
  const clock =
    action.key === 'timer'
      ? (member.appDatas.timer ||= { ...DEFAULT_TIMER, records: [], timestamp: now })
      : (member.appDatas.countdown ||= defaultCountdown());
  const timer = action.key === 'timer';
  if (action.command === 'finish') {
    if (!timer && clock.running && clock.value !== null && clock.value <= now)
      Object.assign(clock, { running: false, value: null, stopTimeStamp: null });
  } else if (action.command === 'reset') {
    Object.assign(clock, { running: false, value: null, stopTimeStamp: null });
    if ('records' in clock) clock.records = [];
    else clock.duration = defaultCountdown().duration;
  } else if (action.command === 'pause') {
    if (clock.running) Object.assign(clock, { running: false, stopTimeStamp: now });
  } else if (action.command === 'start' && !clock.running) {
    clock.value =
      clock.value !== null && clock.stopTimeStamp !== null
        ? clock.value + now - clock.stopTimeStamp
        : timer
          ? now
          : now + action.seconds! * 1000;
    clock.stopTimeStamp = null;
    clock.running = true;
  } else if (
    action.command === 'lap' &&
    'records' in clock &&
    clock.running &&
    clock.value !== null
  ) {
    clock.records = [
      ...clock.records,
      format(Math.floor(Math.max(0, now - clock.value) / 1000)),
    ].slice(-100);
  }
  clock.timestamp = now;
}

export async function nativeWidgetsEndpoint(request: ApiRequest) {
  const { token, principal } = await requireNative(request);
  if (!['POST', 'PUT'].includes(request.method)) throw new AccessError(405, 'METHOD_NOT_ALLOWED');
  const body = await request.json();
  const joinId = parseJoinId(body);
  const access = await requireNativeChatMember(principal, joinId);
  if (!(await accountFlows.allow(`native-widgets:${principal.id}`, 180)))
    throw new AccessError(429, 'RATE_LIMITED');
  if (request.method === 'POST') {
    const info = await spaceRepository.get(access.spaceName);
    if (!info) throw new AccessError(403, 'MEMBERSHIP_REQUIRED');
    const snapshot = widgetSnapshot(info, access.identity);
    await requireNativeChatMember((await requireNative(request)).principal, joinId);
    return ApiResponse.json(snapshot);
  }
  const action = parseNativeWidgetAction(body.action);
  const redis = getSpaceRedisClient();
  if (!redis) throw new StorageUnavailableError();
  for (let attempt = 0; attempt < 5; attempt++) {
    await requireNativeChatMember((await requireNative(request)).principal, joinId);
    const raw = await redis.get(`space:${access.spaceName}`);
    if (!raw) throw new AccessError(403, 'MEMBERSHIP_REQUIRED');
    const info: SpaceInfo = JSON.parse(raw);
    applyWidgetAction(info, access.identity, action, Date.now());
    const result = await redis.eval(
      `
      local sr=redis.call('GET',KEYS[2]); local jr=redis.call('GET',KEYS[3]);
      if not sr or not jr or redis.call('EXISTS',KEYS[4])==1 then return -1 end
      local session=cjson.decode(sr); local entry=cjson.decode(jr)
      if entry.state~='joined' or session.identities[ARGV[3]]~=ARGV[4] then return -1 end
      if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
      redis.call('SET',KEYS[1],ARGV[2]); return 1`,
      4,
      `space:${access.spaceName}`,
      `v1:session:${token}`,
      `v1:native-join:${principal.id}:${joinId}`,
      `v1:revoked:${access.spaceName}:${access.identity}`,
      raw,
      JSON.stringify(info),
      access.spaceName,
      access.identity,
    );
    if (result === -1) throw new AccessError(403, 'MEMBERSHIP_REQUIRED');
    if (result === 0) continue;
    globalThis.vocespaceSocketServer
      ?.to(`space:${access.spaceName}`)
      .emit('user_status_updated', { space: access.spaceName });
    return ApiResponse.json(widgetSnapshot(info, access.identity));
  }
  throw new StorageUnavailableError();
}
