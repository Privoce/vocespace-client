export class ModerationDenied extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
export interface ModerationSpace {
  ownerId: string;
  managers: readonly string[];
  participants: Record<string, unknown>;
  blacklist?: readonly string[];
}
/** Only persisted ownership/membership and server-bound identities authorize a ban. */
export function planSpaceBan(space: ModerationSpace, actor: string, target: string,
  bindings: Record<string, string | undefined>) {
  if (!space.participants[actor] || space.blacklist?.includes(actor) ||
    (space.ownerId !== actor && !space.managers.includes(actor)))
    throw new ModerationDenied(403, 'MANAGER_REQUIRED');
  if (target === actor || target === space.ownerId) throw new ModerationDenied(403, 'PROTECTED_MEMBER');
  if (!space.participants[target] && !space.blacklist?.includes(target))
    throw new ModerationDenied(404, 'MEMBER_NOT_FOUND');
  const sessionId = bindings[target];
  const targets = Object.keys(space.participants).filter((id) =>
    id === target || (!!sessionId && bindings[id] === sessionId));
  if (targets.includes(actor) || targets.includes(space.ownerId))
    throw new ModerationDenied(403, 'PROTECTED_MEMBER');
  return {
    targets,
    blacklist: [...new Set([...(space.blacklist || []), target, ...targets, ...(sessionId ? [sessionId] : [])])],
  };
}
