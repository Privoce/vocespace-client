import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configPath, setConfigPath, readConfiguration } from '@vocespace/config-node';
const directory = path.dirname(fileURLToPath(import.meta.url));
const file = setConfigPath(configPath());
const conf = readConfiguration();
process.chdir(path.resolve(path.dirname(file), conf.deployment.dataDir));
globalThis[Symbol.for('vocespace.assets')] = path.join(directory, 'dist');
await import('./dist/api.cjs');
