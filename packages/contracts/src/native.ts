import { ContractError, parseConnectionDetails, type ConnectionDetails } from './connection';

export interface NativeSession {
  accessToken: string;
  expiresAt: number;
}
export interface NativeJoinRequest {
  joinId: string;
  spaceName: string;
  nickname: string;
}
export interface NativeJoin extends ConnectionDetails {
  joinId: string;
  identity: string;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ContractError('Expected object');
  return value as Record<string, unknown>;
}
export function parseNativeSession(value: unknown): NativeSession {
  const input = record(value);
  if (
    typeof input.accessToken !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.accessToken) ||
    typeof input.expiresAt !== 'number' ||
    !Number.isFinite(input.expiresAt) ||
    input.expiresAt <= 0
  ) {
    throw new ContractError('Invalid native session');
  }
  return { accessToken: input.accessToken, expiresAt: input.expiresAt };
}
export function parseJoinId(value: unknown): string {
  const { joinId } = record(value);
  if (typeof joinId !== 'string' || !/^[a-zA-Z0-9_-]{16,64}$/.test(joinId))
    throw new ContractError('Invalid join ID');
  return joinId;
}
export function parseNativeJoinRequest(value: unknown): NativeJoinRequest {
  const input = record(value);
  const joinId = parseJoinId(input);
  const spaceName = typeof input.spaceName === 'string' ? input.spaceName.trim() : '';
  const nickname = typeof input.nickname === 'string' ? input.nickname.trim() : '';
  if (
    !spaceName ||
    spaceName.length > 200 ||
    /[\\/\0]/.test(spaceName) ||
    ['.', '..', '__proto__', 'constructor', 'prototype'].includes(spaceName) ||
    !nickname ||
    nickname.length > 30
  )
    throw new ContractError('Invalid meeting request');
  return { joinId, spaceName, nickname };
}
export function parseNativeJoin(value: unknown): NativeJoin {
  const input = record(value);
  if (typeof input.identity !== 'string' || !input.identity)
    throw new ContractError('Invalid identity');
  return { ...parseConnectionDetails(input), joinId: parseJoinId(input), identity: input.identity };
}
