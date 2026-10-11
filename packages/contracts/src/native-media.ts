import { ContractError } from './connection';
import { parseJoinId } from './native';

export type NativeDevice = 'microphone' | 'camera' | 'screen';
export interface NativeMediaInvitation {
  id: string;
  device: NativeDevice;
  senderName: string;
  expiresAt: number;
}
export interface NativeMediaStatus {
  sources: NativeDevice[];
  invitations: NativeMediaInvitation[];
}
export function parseNativeDevice(value: unknown): NativeDevice {
  if (value !== 'microphone' && value !== 'camera' && value !== 'screen') throw new ContractError('Invalid device');
  return value;
}
export function parseNativeMediaStatus(value: unknown): NativeMediaStatus {
  if (!value || typeof value !== 'object') throw new ContractError('Invalid media status');
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.sources) || !Array.isArray(data.invitations))
    throw new ContractError('Invalid media status');
  return {
    sources: data.sources.map(parseNativeDevice),
    invitations: data.invitations.map((item) => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.id !== 'string' ||
        typeof item.senderName !== 'string' ||
        typeof item.expiresAt !== 'number' ||
        !Number.isFinite(item.expiresAt)
      )
        throw new ContractError('Invalid invitation');
      return {
        id: item.id,
        device: parseNativeDevice(item.device),
        senderName: item.senderName,
        expiresAt: item.expiresAt,
      };
    }),
  };
}
export function parseNativeMediaRequest(value: unknown) {
  const joinId = parseJoinId(value);
  const data = value as Record<string, unknown>;
  const device = parseNativeDevice(data.device);
  if (typeof data.invitationId !== 'string' || data.invitationId.length > 100)
    throw new ContractError('Invalid invitation ID');
  return { joinId, device, invitationId: data.invitationId };
}
