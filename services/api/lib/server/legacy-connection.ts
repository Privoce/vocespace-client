import { createLegacyConnectionService } from '@vocespace/server-core';
import { AccessToken } from 'livekit-server-sdk';
import { getConfig } from './config';
import { spaceRepository } from './space-repository';

/** HTTP-free composition; shares the repository used by the existing Space API. */
export function createLegacyConnection() {
  // Snapshot media configuration for one request; creation policy is re-read below.
  const media = getConfig().livekit;
  return createLegacyConnectionService({
    getConfig() {
      const config = getConfig();
      return { serverUrl: media.url, createMode: config.create_space, whiteList: config.whiteList };
    },
    async spaceExists(spaceName) {
      return (await spaceRepository.get(spaceName)) !== null;
    },
    async issueToken({ identity, name, roomName, metadata }) {
      const token = new AccessToken(media.key, media.secret, { identity, name, metadata });
      token.ttl = '5m';
      token.addGrant({ room: roomName, roomJoin: true, canPublish: true,
        canPublishData: true, canSubscribe: true, canUpdateOwnMetadata: true });
      return token.toJwt();
    },
  });
}
