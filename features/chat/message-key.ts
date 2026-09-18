import type { ChatMsgItem } from '@/lib/std/chat';

export const chatMessageKey = (message: ChatMsgItem) => message.id || JSON.stringify([
  message.roomName, message.sender.id, message.timestamp, message.type,
  message.message, message.file?.name, message.file?.size,
]);

export function mergeChatMessages(existing: ChatMsgItem[], incoming: ChatMsgItem[]) {
  const messages = new Map(existing.map(message => [chatMessageKey(message), message]));
  incoming.forEach(message => messages.set(chatMessageKey(message), message));
  return [...messages.values()].sort((a, b) => a.timestamp - b.timestamp);
}
