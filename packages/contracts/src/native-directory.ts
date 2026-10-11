import { parseNativeParticipantApps, type NativeParticipantApps } from './native-apps';
import type { NativeAvoPreference } from './native-settings';
import { ContractError } from './connection';
export interface NativeSpaceSummary {
  name: string;
  participantCount: number;
  roomCount: number;
}
export interface NativeRoomSummary {
  name: string;
  participantIds: string[];
}
export interface NativeRoomDirectory {
  participants?: Record<
    string,
    {
      name: string;
      status: string;
      owner: boolean;
      manager?: boolean;
      hue?: number;
      avo?: NativeAvoPreference;
      apps?: NativeParticipantApps;
    }
  >;
  current: string;
  rooms: NativeRoomSummary[];
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ContractError('Invalid directory');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 200)
    throw new ContractError('Invalid directory name');
  return value;
}
export function parseNativeSpaces(value: unknown): NativeSpaceSummary[] {
  if (!Array.isArray(value)) throw new ContractError('Invalid spaces');
  return value.map((item) => {
    const entry = object(item);
    for (const key of ['participantCount', 'roomCount'])
      if (
        typeof entry[key] !== 'number' ||
        !Number.isSafeInteger(entry[key]) ||
        Number(entry[key]) < 0
      )
        throw new ContractError('Invalid count');
    return {
      name: text(entry.name),
      participantCount: entry.participantCount as number,
      roomCount: entry.roomCount as number,
    };
  });
}
export function parseNativeRoomDirectory(value: unknown): NativeRoomDirectory {
  const entry = object(value);
  if (!Array.isArray(entry.rooms)) throw new ContractError('Invalid rooms');
  const rooms = entry.rooms.map((value) => {
    const item = object(value);
    if (!Array.isArray(item.participantIds)) throw new ContractError('Invalid participants');
    return { name: text(item.name), participantIds: item.participantIds.map(text) };
  });
  const current = text(entry.current);
  if (!rooms.some((room) => room.name === current)) throw new ContractError('Missing current room');
  let participants: NativeRoomDirectory['participants'];
  if (entry.participants !== undefined) {
    participants = {};
    for (const [id, raw] of Object.entries(object(entry.participants))) {
      const item = object(raw);
      if (
        typeof item.owner !== 'boolean' ||
        typeof item.status !== 'string' ||
        item.status.length > 500 ||
        (item.hue !== undefined &&
          (typeof item.hue !== 'number' ||
            !Number.isFinite(item.hue) ||
            item.hue < 0 ||
            item.hue > 360))
      )
        throw new ContractError('Invalid participant display');
      let avo: NativeAvoPreference | undefined;
      if (item.manager !== undefined && typeof item.manager !== 'boolean')
        throw new ContractError('Invalid participant role');
      if (item.avo !== undefined) {
        const a = object(item.avo);
        if (
          typeof a.name !== 'string' ||
          a.name.length > 200 ||
          typeof a.hue !== 'number' ||
          !Number.isFinite(a.hue) ||
          a.hue < 0 ||
          a.hue > 360 ||
          typeof a.variant !== 'number' ||
          !Number.isSafeInteger(a.variant) ||
          a.variant < 0 ||
          !['blob', 'ring', 'wave'].includes(String(a.style)) ||
          typeof a.energy !== 'number' ||
          !Number.isFinite(a.energy) ||
          a.energy < 0.1 ||
          a.energy > 1 ||
          typeof a.enabled !== 'boolean' ||
          typeof a.isUsed !== 'boolean'
        )
          throw new ContractError('Invalid participant avatar');
        avo = {
          name: a.name,
          hue: a.hue,
          variant: a.variant,
          style: a.style as NativeAvoPreference['style'],
          energy: a.energy,
          enabled: a.enabled,
          isUsed: a.isUsed,
        };
      }
      participants[text(id)] = {
        name: text(item.name),
        status: item.status,
        owner: item.owner,
        ...(item.manager !== undefined ? { manager: item.manager as boolean } : {}),
        ...(avo ? { avo } : {}),
        ...(item.apps !== undefined ? { apps: parseNativeParticipantApps(item.apps) } : {}),
        ...(item.hue !== undefined ? { hue: item.hue as number } : {}),
      };
    }
  }
  return { current, rooms, ...(participants ? { participants } : {}) };
}
