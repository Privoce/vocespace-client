// @vitest-environment node
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import {
  readTilePlayerFile,
  writeTilePlayerFile,
} from '../services/api/lib/server/tile-player-file';
it('distinguishes missing lists from corrupt lists and keeps concurrent readers on complete snapshots', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tile-list-'));
  const file = path.join(dir, 'tile_players.json');
  try {
    expect(await readTilePlayerFile(file)).toEqual([]);
    await writeFile(file, '{broken');
    await expect(readTilePlayerFile(file)).rejects.toThrow();
    await writeFile(file, '{}');
    await expect(readTilePlayerFile(file)).rejects.toThrow('INVALID_TILE_PLAYER_LIST');
    const before = [{ id: 'iframe' }];
    const after = [{ id: 'iframe' }, { id: 'browser' }];
    await writeTilePlayerFile(file, before);
    const reads = await Promise.all([
      writeTilePlayerFile(file, after),
      ...Array.from({ length: 30 }, () => readTilePlayerFile(file)),
    ]);
    for (const snapshot of reads.slice(1)) expect([before, after]).toContainEqual(snapshot);
    expect(await readTilePlayerFile(file)).toEqual(after);
    expect(await readdir(dir)).toEqual(['tile_players.json']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
