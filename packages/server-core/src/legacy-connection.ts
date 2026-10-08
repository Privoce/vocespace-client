import { parseConnectionRequest, type ConnectionDetails } from '@vocespace/contracts';
import { generateBasicIdentity, matchesCreateWhitelist } from '@vocespace/domain';

export interface LegacyConnectionConfig {
  serverUrl: string;
  createMode: string;
  whiteList?: string[];
}

export interface ParticipantTokenInput {
  identity: string;
  name: string;
  roomName: string;
  metadata: string;
}

export interface LegacyConnectionPorts {
  getConfig(): LegacyConnectionConfig;
  spaceExists(spaceName: string): Promise<boolean>;
  issueToken(input: ParticipantTokenInput): Promise<string>;
}

/**
 * Migration of the existing Web endpoint, NOT the future authenticated App join service.
 * In particular, white_platform still accepts the legacy client-supplied identity.
 * Do not expose this policy as /api/v1 authorization or use it for discovery.
 */
export function createLegacyConnectionService(ports: LegacyConnectionPorts) {
  async function issueParticipant(input: ParticipantTokenInput): Promise<ConnectionDetails> {
    const { serverUrl } = ports.getConfig();
    if (!serverUrl) throw new Error('LiveKit server URL is not configured');
    const participantToken = await ports.issueToken(input);
    return {
      serverUrl,
      roomName: input.roomName,
      participantName: input.name,
      participantToken,
    };
  }

  return {
    // Only call after the adapter has performed its applicable authentication checks.
    issueParticipant,
    async connect(value: unknown): Promise<ConnectionDetails> {
      const input = parseConnectionRequest(value);
      if (!(await ports.spaceExists(input.spaceName))) {
        const { createMode, whiteList } = ports.getConfig();
        const matches = matchesCreateWhitelist(input.participantName, input.identity, whiteList);
        if ((createMode === 'white' && !matches) ||
            (createMode === 'white_platform' && !input.identity && !matches)) {
          throw new Error(
            'Creation failed: you are not in the white list. You are not allowed to create space.',
          );
        }
      }
      return issueParticipant({
        identity: input.identity || generateBasicIdentity(input.participantName, input.spaceName),
        name: input.participantName,
        roomName: input.spaceName,
        metadata: input.metadata || '',
      });
    },
  };
}
