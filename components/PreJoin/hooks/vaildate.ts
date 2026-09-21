import { api } from '@/lib/api';
import type { PlatformUser } from '@/lib/std';
import type { SpaceInfo } from '@/lib/std/space';
import type { LocalUserChoices } from '@livekit/components-react';

export class PreJoinError extends Error {
  constructor(public messageKey: 'msg.error.user.username.request' | 'msg.error.user.username.exist' | 'common.guest.not_allow') {
    super(messageKey);
  }
}

/** UI preflight only; token issuance remains the server's authorization boundary. */
export async function validatePreJoin({ space, data, ...choices }: LocalUserChoices & {
  space: string;
  data?: PlatformUser;
}, client = api): Promise<LocalUserChoices> {
  const username = choices.username.trim();
  const response = username
    ? await client.checkUsername(space, username, data?.id)
    : await client.getUniqueUsername(space);
  if (!response.ok) throw new PreJoinError('msg.error.user.username.request');
  const result = await response.json();
  if (username && !result.success) throw new PreJoinError('msg.error.user.username.exist');
  if (typeof result.name !== 'string' || !result.name.trim()) throw new PreJoinError('msg.error.user.username.request');
  const settingsResponse = await client.getSpaceInfo(space);
  if (!settingsResponse.ok) throw new Error(`Failed to fetch settings: ${settingsResponse.status}`);
  const { settings }: { settings?: Partial<SpaceInfo> } = await settingsResponse.json();
  if (settings?.allowGuest === 'disable' && (!data || data.identity === 'guest')) {
    throw new PreJoinError('common.guest.not_allow');
  }
  return { ...choices, username: result.name };
}
