import dotenv from 'dotenv';
import path from 'node:path';

// Set the data root before importing modules with cwd-derived storage paths.
if (process.env.VOCESPACE_DATA_DIR) process.chdir(path.resolve(process.env.VOCESPACE_DATA_DIR));
for (const file of ['.env.local', `.env.${process.env.NODE_ENV || 'development'}`, '.env']) {
  dotenv.config({ path: file });
}
void import('./main');
