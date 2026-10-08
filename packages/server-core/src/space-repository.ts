/** Storage model stays in the adapter until the full Space DTO migration is complete. */
export interface SpaceRepository<Space> {
  get(name: string): Promise<Space | null>;
  save(name: string, space: Space): Promise<void>;
  list(): Promise<Record<string, Space>>;
}

export class StorageUnavailableError extends Error {
  constructor() {
    super('Space storage is unavailable');
    this.name = 'StorageUnavailableError';
  }
}

export interface SpaceStoragePort {
  read(name: string): Promise<string | null>;
  writeAndIndex(name: string, json: string): Promise<void>;
  names(): Promise<string[]>;
}

/** Missing data is null; failures propagate and must never become permission to create. */
export function createSpaceRepository<Space>(
  storage: SpaceStoragePort,
  decode: (value: unknown) => Space,
): SpaceRepository<Space> {
  async function get(name: string) {
    const json = await storage.read(name);
    if (json === null) return null;
    try {
      return decode(JSON.parse(json));
    } catch {
      throw new StorageUnavailableError();
    }
  }
  return {
    get,
    async save(name, space) {
      await storage.writeAndIndex(name, JSON.stringify(space));
    },
    async list() {
      const result: Record<string, Space> = Object.create(null);
      for (const name of await storage.names()) {
        const space = await get(name);
        if (space !== null) result[name] = space;
      }
      return result;
    },
  };
}
