import { existsSync } from 'node:fs';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeData } from './initialize-data.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, '../..');
// Preserve existing data when invoked by pnpm --filter (which changes cwd).
const workspace = existsSync(path.join(repository, 'pnpm-workspace.yaml'));
const inputs = process.env.VOCESPACE_DATA_DIR
  ? [path.resolve(process.env.VOCESPACE_DATA_DIR)]
  : workspace ? [directory, repository] : [directory];
for (const input of inputs) {
  for (const name of ['.env.local', `.env.${process.env.NODE_ENV || 'development'}`, '.env']) {
    dotenv.config({ path: path.join(input, name) });
  }
}
process.env.VOCESPACE_DATA_DIR ||= workspace ? repository : process.cwd();
process.env.VOCESPACE_PROMPT_DIR ||= path.join(directory, 'dist/prompt');
process.env.VOCESPACE_PREVIEW_ASSETS ||= path.join(directory, 'dist/preview');
initializeData(process.env.VOCESPACE_DATA_DIR);
await import('./dist/api.cjs');
