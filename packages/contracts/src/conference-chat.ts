import { ContractError } from './connection';
import { parseJoinId } from './native';

export const CONFERENCE_CHAT_LIMIT = 50;
export const CONFERENCE_MESSAGE_LIMIT = 4000;
export interface ConferenceMessage {
  id: string;
  roomName: string;
  sender: { id: string; name: string };
  timestamp: number;
  type: 'text' | 'file';
  message: string | null;
  file?: { name: string; type: string; storageName: string };
}
export interface NativeChatRequest {
  joinId: string;
  id: string;
  roomName: string;
  message: string;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ContractError('Expected chat object');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.length || value.length > max)
    throw new ContractError('Invalid chat field');
  return value;
}
export function parseNativeChatRequest(value: unknown): NativeChatRequest {
  const input = record(value);
  const message = text(input.message, CONFERENCE_MESSAGE_LIMIT).trim();
  if (!message || input.type !== 'text' || input.file != null)
    throw new ContractError('Invalid text message');
  return {
    joinId: parseJoinId(input),
    id: text(input.id, 100),
    roomName: text(input.roomName, 200),
    message,
  };
}
/** Display metadata only; download capabilities are obtained through the member API. */
export function parseConferenceMessage(value: unknown): ConferenceMessage {
  const input = record(value);
  const sender = record(input.sender);
  if (
    !['text', 'file'].includes(String(input.type)) ||
    typeof input.timestamp !== 'number' ||
    !Number.isFinite(input.timestamp) ||
    input.timestamp < 0 ||
    (input.type === 'text' && typeof input.message !== 'string')
  )
    throw new ContractError('Invalid chat message');
  const message = input.type === 'text' ? (input.message as string) : null;
  let file: ConferenceMessage['file'];
  if (input.type === 'file' && input.file && typeof input.file === 'object') {
    const attachment = input.file as Record<string, unknown>;
    try {
      const storageName =
        typeof attachment.storageName === 'string'
          ? attachment.storageName
          : typeof attachment.url === 'string'
            ? decodeURIComponent(
                new URL(attachment.url, 'https://file.invalid').pathname.split('/').pop() || '',
              )
            : '';
      if (
        storageName &&
        storageName !== '.' &&
        storageName !== '..' &&
        !/[/\\\x00-\x1f]/.test(storageName) &&
        storageName.length <= 255
      ) {
        file = {
          storageName,
          name: typeof attachment.name === 'string' ? attachment.name.slice(0, 200) : storageName,
          type: typeof attachment.type === 'string' ? attachment.type.slice(0, 100) : '',
        };
      }
    } catch {
      /* Old messages without valid metadata retain the file-list fallback. */
    }
  }
  return {
    id: text(input.id, 100),
    roomName: text(input.roomName, 200),
    sender: { id: text(sender.id, 200), name: text(sender.name, 200) },
    timestamp: input.timestamp,
    type: input.type as 'text' | 'file',
    ...(file ? { file } : {}),
    message:
      message && message.length > CONFERENCE_MESSAGE_LIMIT
        ? `${message.slice(0, CONFERENCE_MESSAGE_LIMIT)}…`
        : message,
  };
}
export function parseConferenceHistory(value: unknown): ConferenceMessage[] {
  const { items } = record(value);
  if (!Array.isArray(items) || items.length > CONFERENCE_CHAT_LIMIT)
    throw new ContractError('Invalid chat history');
  return items.map(parseConferenceMessage);
}
