import { rm } from 'node:fs/promises';
import path from 'node:path';

/** Only call after an authorized Space deletion; never accept an arbitrary filesystem path. */
export async function removeSpaceFiles(space: string) {
  if (!space || /[\\/\0]/.test(space) || ['.', '..'].includes(space)) throw new Error('Invalid space path');
  await rm(path.join(process.cwd(), 'uploads', space), { recursive: true, force: true });
}
