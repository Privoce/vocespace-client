import { ContractError } from './connection';
export const API_VERSION = 1;
export interface ApiFailure { code: string; message?: string; requestId: string; }
export interface Page<T> { items: T[]; nextCursor: string | null; }
export interface EventAcknowledgement { ok: boolean; id?: string; duplicate?: boolean; code?: string; }
export function parsePageLimit(value: unknown): number {
  if (value === undefined || value === null) return 50;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ContractError('Invalid page limit');
  return limit;
}
