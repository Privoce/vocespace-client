import type { NativeDevice, NativeMediaInvitation } from '@vocespace/contracts';

/** An invitation authorizes one source; joining or raising a hand never grants publishing. */
export function canAcceptNativeInvitation(
  invitation: NativeMediaInvitation | null,
  device: NativeDevice,
  invitationId: string,
  inviterIsManager: boolean,
  now: number,
) {
  return (
    !!invitation &&
    inviterIsManager &&
    invitation.device === device &&
    invitation.id === invitationId &&
    invitation.expiresAt > now
  );
}
