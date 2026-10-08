/** JSON wire types only; no LiveKit, React or persistence types. */
export interface ConnectionDetails {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
}

export interface ConnectionRequest {
  spaceName: string;
  participantName: string;
  identity?: string;
  metadata?: string;
  region?: string;
}

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractError';
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContractError('Expected an object');
  }
  return value as Record<string, unknown>;
}

/** Keep legacy empty-string semantics; tightening product validation is a separate migration. */
export function parseConnectionRequest(value: unknown): ConnectionRequest {
  const input = object(value);
  for (const key of ['spaceName', 'participantName'] as const) {
    if (typeof input[key] !== 'string') {
      throw new ContractError(`Missing required query parameter: ${key}`);
    }
  }
  const result: ConnectionRequest = {
    spaceName: input.spaceName as string,
    participantName: input.participantName as string,
  };
  for (const key of ['identity', 'metadata', 'region'] as const) {
    if (input[key] === undefined || input[key] === null) continue;
    if (typeof input[key] !== 'string') throw new ContractError(`Invalid parameter: ${key}`);
    result[key] = input[key];
  }
  return result;
}

export function parseConnectionDetails(value: unknown): ConnectionDetails {
  const input = object(value);
  for (const key of ['serverUrl', 'roomName', 'participantName', 'participantToken'] as const) {
    if (typeof input[key] !== 'string') throw new ContractError(`Invalid connection details: ${key}`);
  }
  return {
    serverUrl: input.serverUrl as string,
    roomName: input.roomName as string,
    participantName: input.participantName as string,
    participantToken: input.participantToken as string,
  };
}
