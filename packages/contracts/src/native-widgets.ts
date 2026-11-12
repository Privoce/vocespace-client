import { ContractError } from './connection';
import { parseNativeParticipantApps, type NativeParticipantApps } from './native-apps';

export type NativeWidgetKey = 'todo' | 'timer' | 'countdown';
export interface NativeWidgetTodo {
  id: string;
  title: string;
  done?: number;
  visible: boolean;
}
export interface NativeWidgets {
  name: string;
  enabled: NativeWidgetKey[];
  sync: NativeWidgetKey[];
  todo: { date: number; items: NativeWidgetTodo[] }[];
  timer: NonNullable<NativeParticipantApps['timer']>;
  countdown: NonNullable<NativeParticipantApps['countdown']>;
}
export type NativeWidgetAction =
  | { kind: 'sync'; key: NativeWidgetKey; visible: boolean }
  | { kind: 'todo-add'; id: string; title: string }
  | { kind: 'todo-edit'; id: string; title: string }
  | { kind: 'todo-done'; id: string; done: boolean }
  | { kind: 'todo-delete'; id: string }
  | { kind: 'countdown-set'; seconds: number }
  | {
      kind: 'clock';
      key: 'timer' | 'countdown';
      command: 'start' | 'pause' | 'reset' | 'lap' | 'finish';
      seconds?: number;
    };
const fail = (): never => {
  throw new ContractError('Invalid widgets');
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
const key = (value: unknown): NativeWidgetKey =>
  value === 'todo' || value === 'timer' || value === 'countdown' ? value : fail();
const stamp = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fail();
const title = (value: unknown): string =>
  typeof value === 'string' && value.trim() && value.length <= 10000 ? value.trim() : fail();

export function parseNativeWidgetAction(raw: unknown): NativeWidgetAction {
  const v = object(raw);
  const only = (...fields: string[]) => {
    if (Object.keys(v).some((field) => !['kind', ...fields].includes(field))) fail();
  };
  if (v.kind === 'sync') {
    only('key', 'visible');
    if (typeof v.visible !== 'boolean') return fail();
    return { kind: v.kind, key: key(v.key), visible: v.visible };
  }
  if (v.kind === 'clock') {
    only('key', 'command', 'seconds');
    if (
      (v.key !== 'timer' && v.key !== 'countdown') ||
      !['start', 'pause', 'reset', 'lap', 'finish'].includes(String(v.command)) ||
      (v.key === 'countdown' && v.command === 'lap') ||
      (v.key === 'timer' && v.command === 'finish')
    )
      return fail();
    const seconds = v.seconds === undefined ? undefined : stamp(v.seconds);
    if (
      v.key === 'countdown' &&
      v.command === 'start' &&
      (seconds === undefined || seconds < 1 || seconds > 86399)
    )
      return fail();
    return {
      kind: v.kind,
      key: v.key,
      command: v.command as 'start' | 'pause' | 'reset' | 'lap' | 'finish',
      seconds,
    };
  }
  if (v.kind === 'countdown-set') {
    only('seconds');
    const seconds = stamp(v.seconds);
    if (seconds < 1 || seconds > 86399) return fail();
    return { kind: v.kind, seconds };
  }
  if (typeof v.id !== 'string' || !/^\d{1,16}$/.test(v.id)) return fail();
  if (v.kind === 'todo-add' || v.kind === 'todo-edit') {
    only('id', 'title');
    return { kind: v.kind, id: v.id, title: title(v.title) };
  }
  if (v.kind === 'todo-done' && typeof v.done === 'boolean') {
    only('id', 'done');
    return { kind: v.kind, id: v.id, done: v.done };
  }
  if (v.kind === 'todo-delete') {
    only('id');
    return { kind: v.kind, id: v.id };
  }
  return fail();
}

export function parseNativeWidgets(raw: unknown): NativeWidgets {
  const v = object(raw);
  if (
    typeof v.name !== 'string' ||
    !Array.isArray(v.enabled) ||
    !Array.isArray(v.sync) ||
    !Array.isArray(v.todo) ||
    v.todo.length > 10000
  )
    return fail();
  const clocks = parseNativeParticipantApps({ timer: v.timer, countdown: v.countdown });
  if (!clocks.timer || !clocks.countdown) return fail();
  const todo = v.todo.map((raw) => {
    const group = object(raw);
    if (!Array.isArray(group.items) || group.items.length > 10000) return fail();
    return {
      date: stamp(group.date),
      items: group.items.map((raw) => {
        const item = object(raw);
        if (typeof item.id !== 'string' || typeof item.visible !== 'boolean') return fail();
        return {
          id: item.id,
          title: title(item.title),
          visible: item.visible,
          ...(item.done === undefined ? {} : { done: stamp(item.done) }),
        };
      }),
    };
  });
  return {
    name: v.name,
    enabled: v.enabled.map(key),
    sync: v.sync.map(key),
    todo,
    timer: clocks.timer,
    countdown: clocks.countdown,
  };
}
