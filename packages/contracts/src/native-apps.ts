import { ContractError } from './connection';
/** Read projection of explicitly shared participant tools. Never contains hidden tasks. */
export interface NativeParticipantApps {
  todo?: { id: string; title: string; done: boolean }[];
  timer?: {
    value: number | null;
    running: boolean;
    stopTimeStamp: number | null;
    records: string[];
  };
  countdown?: {
    value: number | null;
    running: boolean;
    stopTimeStamp: number | null;
    duration: string | null;
  };
}
export function parseNativeParticipantApps(raw: unknown): NativeParticipantApps {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new ContractError('Invalid apps');
  const value = raw as Record<string, unknown>,
    result: NativeParticipantApps = {};
  if (value.todo !== undefined) {
    if (!Array.isArray(value.todo) || value.todo.length > 1000)
      throw new ContractError('Invalid todos');
    result.todo = value.todo.map((raw) => {
      if (!raw || typeof raw !== 'object') throw new ContractError('Invalid todo');
      const item = raw as Record<string, unknown>;
      if (
        typeof item.id !== 'string' ||
        typeof item.title !== 'string' ||
        item.title.length > 10000 ||
        typeof item.done !== 'boolean'
      )
        throw new ContractError('Invalid todo');
      return { id: item.id, title: item.title, done: item.done };
    });
  }
  for (const key of ['timer', 'countdown'] as const) {
    const raw = value[key];
    if (raw === undefined) continue;
    if (!raw || typeof raw !== 'object') throw new ContractError('Invalid timer');
    const v = raw as Record<string, unknown>;
    const stamp = (n: unknown) =>
      n === null || (typeof n === 'number' && Number.isFinite(n) && n >= 0);
    if (!stamp(v.value) || !stamp(v.stopTimeStamp) || typeof v.running !== 'boolean')
      throw new ContractError('Invalid timer');
    const base = {
      value: v.value as number | null,
      stopTimeStamp: v.stopTimeStamp as number | null,
      running: v.running,
    };
    if (key === 'timer') {
      if (
        !Array.isArray(v.records) ||
        v.records.length > 100 ||
        !v.records.every((s) => typeof s === 'string' && s.length < 100)
      )
        throw new ContractError('Invalid records');
      result.timer = { ...base, records: v.records as string[] };
    } else {
      if (v.duration !== null && typeof v.duration !== 'string')
        throw new ContractError('Invalid duration');
      result.countdown = { ...base, duration: v.duration as string | null };
    }
  }
  return result;
}
