export interface SpaceAccessSnapshot {
  ownerId: string;
  managers: readonly string[];
  participants: Record<string, unknown>;
}
/** Authorization always uses persisted ownership, never a client-provided role. */
export function spaceAccess(space: SpaceAccessSnapshot | null, identity: string | undefined) {
  const owner = !!identity && space?.ownerId === identity;
  return { owner, manager: owner || !!identity && !!space?.managers.includes(identity),
    member: !!identity && !!space?.participants[identity] };
}
