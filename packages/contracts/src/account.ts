import { ContractError } from './connection';
export interface AccountUser {
  id: string;
  email: string;
  nickname: string;
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
export function parseAccountUser(value: unknown): AccountUser {
  const user = accountObject(value);
  const id = accountString(user.id, 36);
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id))
    throw new ContractError('Invalid user id');
  return { id, email: accountString(user.email, 254), nickname: accountString(user.nickname, 100) };
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
