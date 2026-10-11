import type { SessionPrincipal } from './session';

export interface NativeChatAccess {
  state: string;
  identity: string;
  spaceName: string;
  member: boolean;
  revoked: boolean;
  /** Compatibility field: true only when guest access is allowed and current public-room membership matches. */
  mainRoomOnly: boolean;
}
/** Shared HTTP/Socket policy. A prepared RTC connection is not a chat membership. */
export function canUseNativeChat(
  principal: SessionPrincipal,
  entry: NativeChatAccess | null,
  enabledSpace: string | undefined,
  now: number,
): entry is NativeChatAccess {
  return (
    !!entry &&
    principal.client === 'native' &&
    principal.expiresAt > now &&
    entry.state === 'joined' &&
    entry.spaceName === enabledSpace &&
    principal.identities[entry.spaceName] === entry.identity &&
    entry.member &&
    !entry.revoked &&
    entry.mainRoomOnly
  );
}
