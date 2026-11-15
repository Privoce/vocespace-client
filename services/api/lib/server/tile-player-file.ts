import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export async function readTilePlayerFile<T>(file: string): Promise<T[]> {
  try {
    const data: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(data)) throw new Error('INVALID_TILE_PLAYER_LIST');
    return data as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

// Readers see a complete old or new snapshot, never a truncated JSON file.
export async function writeTilePlayerFile(file: string, players: unknown[]) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(players, null, 2), 'utf8');
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
