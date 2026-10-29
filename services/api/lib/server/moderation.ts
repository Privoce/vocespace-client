import type { SpaceInfo } from '@vocespace/domain/space';
import type { SessionPrincipal } from '@vocespace/server-core';

export const memberSessionKey = (space: string, identity: string) =>
  `v1:member-session:${space}:${identity}`;
export function isSpaceBlocked(space: SpaceInfo, principal: SessionPrincipal, identity?: string) {
  const ids = [identity, principal.id,
    principal.platform?.id];
  return (space.blacklist || []).some((id) => ids.includes(id));
}
