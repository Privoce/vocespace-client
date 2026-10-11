import { ContractError } from './connection';
export type NativePreview =
  | { status: 'starting' | 'unavailable' }
  | { status: 'ready'; leaseId: string; url: string; expiresAt: number };
export function parseNativePreview(value: unknown): NativePreview {
  if (!value || typeof value !== 'object') throw new ContractError('Invalid preview');
  const input = value as Record<string, unknown>;
  if (input.status === 'starting' || input.status === 'unavailable')
    return { status: input.status };
  if (
    input.status !== 'ready' ||
    typeof input.leaseId !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.leaseId) ||
    typeof input.url !== 'string' ||
    !/^https?:\/\//.test(input.url) ||
    typeof input.expiresAt !== 'number' ||
    !Number.isFinite(input.expiresAt)
  )
    throw new ContractError('Invalid preview');
  return { status: 'ready', leaseId: input.leaseId, url: input.url, expiresAt: input.expiresAt };
}
