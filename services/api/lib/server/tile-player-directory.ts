import path from 'node:path';
import { copyFile, mkdir, rename } from 'node:fs/promises';
import { constants } from 'node:fs';
import { readTilePlayerFile, writeTilePlayerFile } from './tile-player-file';

// Old Web clients used uploads/space/space for the main room; Native used uploads/space.
// Both adapters now resolve the main room here. Keep old image URLs working after migration.
const migrations = new Map<string, Promise<void>>();
export async function tilePlayerDirectory(space: string, room?: string, root = process.cwd()) {
  const dir = path.join(root, 'uploads', space, room && room !== space ? room : '');
  if (room && room !== space) return dir;
  let pending = migrations.get(dir);
  if (!pending) {
    pending = (async () => {
      const legacy = path.join(dir, space, 'tile_players.json');
      const old = await readTilePlayerFile<{ id: string; fileName?: string }>(legacy);
      if (!old.length) return;
      const target = path.join(dir, 'tile_players.json');
      const current = await readTilePlayerFile<{ id: string }>(target);
      await mkdir(dir, { recursive: true });
      for (const item of old) {
        if (item.fileName && path.basename(item.fileName) === item.fileName) {
          await copyFile(
            path.join(dir, space, item.fileName),
            path.join(dir, item.fileName),
            constants.COPYFILE_EXCL,
          ).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'EEXIST' && error.code !== 'ENOENT') throw error;
          });
        }
      }
      await writeTilePlayerFile(target, [
        ...current,
        ...old.filter((item) => !current.some((entry) => entry.id === item.id)),
      ]);
      await rename(legacy, `${legacy}.migrated`);
    })().finally(() => migrations.delete(dir));
    migrations.set(dir, pending);
  }
  await pending;
  return dir;
}
