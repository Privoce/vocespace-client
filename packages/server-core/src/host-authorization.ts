export class HostAuthorizationError extends Error {
  constructor() {
    super('invalid host token');
    this.name = 'HostAuthorizationError';
  }
}

/** A shared decision for sensitive configuration commands; secret comparison is an adapter. */
export function authorizeHostMutation(input: {
  token: unknown;
  initialSetup: boolean;
  initialized: boolean;
}, verify: (token: string) => boolean): void {
  if (input.initialSetup && !input.initialized) return;
  if (typeof input.token !== 'string' || !input.token || !verify(input.token)) {
    throw new HostAuthorizationError();
  }
}
