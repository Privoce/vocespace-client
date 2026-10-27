import { ContractError } from './connection';
export interface AccountUser {
  id: string;
  email: string;
  nickname: string;
  /** Unique platform username; absent in legacy cached sessions. Never a display nickname. */
  username?: string;
  avatar?: string;
}
export interface AccountSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AccountUser;
}
export interface AccountRegistration {
  session: AccountSession | null;
  confirmationRequired: boolean;
}
export function accountObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ContractError('Invalid account data');
  return value as Record<string, unknown>;
}
export function accountString(value: unknown, max = 4096): string {
  if (typeof value !== 'string' || !value.length || value.length > max)
    throw new ContractError('Invalid account field');
  return value;
}
export function accountCredentials(value: unknown) {
  const input = accountObject(value);
  const email = accountString(input.email, 254).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ContractError('Invalid email');
  return { email, password: accountString(input.password, 256) };
}
/** Display fallback uses the unique username, never the editable nickname. */
export function accountAvatarInitial(username: string): string {
  return Array.from(username.trim())[0]?.toUpperCase() || '?';
}
export const ACCOUNT_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const ACCOUNT_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export function accountAvatarUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 4096) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function parseAccountUser(value: unknown): AccountUser {
  const user = accountObject(value);
  const id = accountString(user.id, 36);
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id))
    throw new ContractError('Invalid user id');
  return {
    id,
    email: accountString(user.email, 254),
    nickname: accountString(user.nickname, 100),
    ...(accountAvatarUrl(user.avatar) ? { avatar: accountAvatarUrl(user.avatar) } : {}),
    ...(user.username === undefined ? {} : { username: accountString(user.username, 254) }),
  };
}
export function accountCode(value: unknown) {
  const input = accountObject(value);
  const { email } = accountCredentials({ ...input, password: 'unused' });
  const code = accountString(input.code, 6);
  if (!/^\d{6}$/.test(code)) throw new ContractError('Invalid verification code');
  return { email, code };
}
/** Display names do not change the unique username or any account identity. */
export function accountNickname(value: unknown): string {
  const input = accountObject(value);
  if (Object.keys(input).some((key) => key !== 'nickname'))
    throw new ContractError('Invalid profile field');
  const nickname = accountString(input.nickname, 120).trim();
  if (!nickname || Array.from(nickname).length > 30 || /[\u0000-\u001f\u007f]/.test(nickname))
    throw new ContractError('Invalid nickname');
  return nickname;
}
export function parseAccountSession(value: unknown): AccountSession {
  const session = accountObject(value);
  if (typeof session.expiresAt !== 'number' || !Number.isFinite(session.expiresAt))
    throw new ContractError('Invalid expiry');
  return {
    accessToken: accountString(session.accessToken, 16384),
    refreshToken: accountString(session.refreshToken),
    expiresAt: session.expiresAt,
    user: parseAccountUser(session.user),
  };
}
export function parseAccountRegistration(value: unknown): AccountRegistration {
  const result = accountObject(value);
  if (typeof result.confirmationRequired !== 'boolean')
    throw new ContractError('Invalid registration');
  return {
    confirmationRequired: result.confirmationRequired,
    session: result.session === null ? null : parseAccountSession(result.session),
  };
}

/** Owned platform rooms; conference authorization is still checked separately on join. */
export interface AccountSpace {
  id: string;
  name: string;
  url: string;
  kind: string;
}
export function parseAccountSpaces(value: unknown): AccountSpace[] {
  if (!Array.isArray(value)) throw new ContractError('Invalid account spaces');
  return value.map((raw) => {
    const item = accountObject(raw);
    return {
      id: accountString(item.id, 200),
      name: accountString(item.name, 200),
      url: accountString(item.url, 2048),
      kind: accountString(item.kind, 100),
    };
  });
}
