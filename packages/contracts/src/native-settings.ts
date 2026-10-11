import { ContractError } from './connection';
export const settingsPermissionKeys = [
  'viewRoom',
  'createRoom',
  'manageRoom',
  'manageRole',
  'controlUser',
  'recording',
  'manageFile',
  'managePlayer',
] as const;
export const settingsRoles = ['owner', 'manager', 'participant', 'guest'] as const;
export interface NativeAvoPreference {
  name: string;
  variant: number;
  hue: number;
  style: 'blob' | 'ring' | 'wave';
  energy: number;
  isUsed: boolean;
  enabled: boolean;
}
export interface NativeSettingsSnapshot {
  room?: {
    isOwner: boolean;
    isManager: boolean;
    persistence: boolean;
    allowGuest: 'allow' | 'link' | 'disable';
    apps: Array<'timer' | 'countdown' | 'todo'>;
    canReadRecordings: boolean;
  };
  avoList: NativeAvoPreference[];
  virtual: { role: string; bg: string; enabled: boolean };
  name: string;
  status: string;
  volume: number;
  openPromptSound: boolean;
  openShareAudio: boolean;
  blur: number;
  screenBlur: number;
  appAuth: 'read' | 'write';
  audioProcessing: {
    noiseSuppression: boolean;
    echoCancellation: boolean;
    autoGainControl: boolean;
  };
  permissions: Record<
    (typeof settingsRoles)[number],
    Record<(typeof settingsPermissionKeys)[number], boolean>
  >;
}
/** Explicit projection: deployment keys, other users and credentials never cross this boundary. */
export function parseNativeSettingsSnapshot(value: unknown): NativeSettingsSnapshot {
  const fail = (): never => {
    throw new ContractError('INVALID_NATIVE_SETTINGS');
  };
  const object = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : fail();
  const bool = (value: unknown) => (typeof value === 'boolean' ? value : fail());
  const num = (value: unknown, max: number) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
      ? value
      : fail();
  const text = (value: unknown) =>
    typeof value === 'string' && value.length <= 500 ? value : fail();
  const input = object(value);
  const audio = object(input.audioProcessing);
  const auth = object(input.permissions);
  const virtual = object(input.virtual);
  if (!Array.isArray(input.avoList)) return fail();
  const avoList = input.avoList.map((value): NativeAvoPreference => {
    const item = object(value);
    return {
      name: text(item.name),
      variant: num(item.variant, Number.MAX_SAFE_INTEGER),
      hue: num(item.hue, 360),
      style:
        item.style === 'blob' || item.style === 'ring' || item.style === 'wave'
          ? item.style
          : fail(),
      energy: num(item.energy, 1),
      isUsed: bool(item.isUsed),
      enabled: bool(item.enabled),
    };
  });
  const permissions = {} as NativeSettingsSnapshot['permissions'];
  for (const role of settingsRoles) {
    const conf = object(auth[role]);
    permissions[role] = {} as NativeSettingsSnapshot['permissions']['guest'];
    for (const key of settingsPermissionKeys) permissions[role][key] = bool(conf[key]);
  }
  let room: NativeSettingsSnapshot['room'];
  if (input.room !== undefined) {
    const r = object(input.room);
    if (
      !['allow', 'link', 'disable'].includes(String(r.allowGuest)) ||
      !Array.isArray(r.apps) ||
      r.apps.some((v) => !['timer', 'countdown', 'todo'].includes(v))
    )
      return fail();
    room = {
      isOwner: bool(r.isOwner),
      isManager: bool(r.isManager),
      persistence: bool(r.persistence),
      allowGuest: r.allowGuest as 'allow' | 'link' | 'disable',
      apps: r.apps as Array<'timer' | 'countdown' | 'todo'>,
      canReadRecordings: bool(r.canReadRecordings),
    };
  }
  return {
    ...(room ? { room } : {}),
    avoList,
    virtual: { role: text(virtual.role), bg: text(virtual.bg), enabled: bool(virtual.enabled) },
    name: text(input.name),
    status: text(input.status),
    volume: num(input.volume, 100),
    openPromptSound: bool(input.openPromptSound),
    openShareAudio: bool(input.openShareAudio),
    blur: num(input.blur, 1),
    screenBlur: num(input.screenBlur, 1),
    appAuth: input.appAuth === 'read' || input.appAuth === 'write' ? input.appAuth : fail(),
    audioProcessing: {
      noiseSuppression: bool(audio.noiseSuppression),
      echoCancellation: bool(audio.echoCancellation),
      autoGainControl: bool(audio.autoGainControl),
    },
    permissions,
  };
}

export type NativeSettingsPatch = Partial<Omit<NativeSettingsSnapshot, 'room'>> & {
  persistence?: boolean;
  allowGuest?: 'allow' | 'link' | 'disable';
  apps?: Array<'timer' | 'countdown' | 'todo'>;
};
export const nativePreferenceKeys = [
  'name',
  'status',
  'volume',
  'openPromptSound',
  'openShareAudio',
  'blur',
  'screenBlur',
  'appAuth',
  'audioProcessing',
  'avoList',
  'virtual',
] as const;

/** Validate a patch against the current snapshot, preserving fields not included by the caller. */
export function parseNativeSettingsPatch(
  value: unknown,
  current: NativeSettingsSnapshot,
): NativeSettingsPatch {
  const fail = (): never => {
    throw new ContractError('INVALID_NATIVE_SETTINGS');
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  const allowed = [...nativePreferenceKeys, 'permissions', 'persistence', 'allowGuest', 'apps'];
  if (!keys.length || keys.some((key) => !allowed.includes(key))) return fail();
  const merged = parseNativeSettingsSnapshot({ ...current, ...input });
  const output: Record<string, unknown> = {};
  for (const key of [...nativePreferenceKeys, 'permissions'] as const)
    if (key in input) output[key] = merged[key];
  if ('name' in output && (!String(output.name).trim() || String(output.name).length > 80))
    return fail();
  if ('status' in output && String(output.status).length > 100) return fail();
  if (merged.avoList.length > 30) return fail();
  if ('persistence' in input) {
    if (typeof input.persistence !== 'boolean') return fail();
    output.persistence = input.persistence;
  }
  if ('allowGuest' in input) {
    if (!['allow', 'link', 'disable'].includes(String(input.allowGuest))) return fail();
    output.allowGuest = input.allowGuest;
  }
  if ('apps' in input) {
    if (
      !Array.isArray(input.apps) ||
      input.apps.length > 3 ||
      input.apps.some((v) => !['timer', 'countdown', 'todo'].includes(v))
    )
      return fail();
    output.apps = [...new Set(input.apps)];
  }
  return output as NativeSettingsPatch;
}
