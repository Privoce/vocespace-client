import { cp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'apps/web');
const output = path.join(web, '.next/standalone');
const app = path.join(output, 'apps/web');
const require = createRequire(path.join(web, 'package.json'));
const artifactRoot = await realpath(output);
await mkdir(path.join(app, 'node_modules'), { recursive: true });
for (const directory of [app, path.join(app, 'node_modules'), path.join(app, '.next')]) {
  if (!(await realpath(directory)).startsWith(`${artifactRoot}${path.sep}`)) {
    throw new Error('Standalone directories must stay inside their artifact; use an isolated dependency installation for copied builds');
  }
}
// Next's generated server does not include our HTTP / Socket upgrade proxy.
// Package the actual custom server and its one extra runtime dependency.
await cp(path.join(web, 'server.js'), path.join(app, 'proxy-server.mjs'));
// Match Next's standalone bootstrapping: avoid loading build-time webpack hooks
// from next.config when only traced production dependencies are present.
await writeFile(path.join(app, 'server.js'), `import { readFile } from 'node:fs/promises';
const { config } = JSON.parse(await readFile(new URL('./.next/required-server-files.json', import.meta.url), 'utf8'));
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
await import('./proxy-server.mjs');
`);
await cp(path.join(web, 'next.config.mjs'), path.join(app, 'next.config.mjs'));
const publicDirectory = path.join(web, 'public');
// Replace generated destinations, including any old symlink, without following it.
await rm(path.join(app, 'public'), { recursive: true, force: true });
await cp(publicDirectory, path.join(app, 'public'), {
  recursive: true,
  filter: (source) => {
    const relative = path.relative(publicDirectory, source);
    return relative !== 'license' && !relative.startsWith(`license${path.sep}`) && path.basename(source) !== '.DS_Store';
  },
});
await rm(path.join(app, '.next/static'), { recursive: true, force: true });
await cp(path.join(web, '.next/static'), path.join(app, '.next/static'), { recursive: true });
const dotenv = path.dirname(await realpath(require.resolve('dotenv/package.json')));
// Tracing may already create a symlink here; replace only this generated artifact entry.
await rm(path.join(app, 'node_modules/dotenv'), { recursive: true, force: true });
await cp(dotenv, path.join(app, 'node_modules/dotenv'), { recursive: true });
await writeFile(path.join(output, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
await writeFile(path.join(output, 'server.js'), "import './apps/web/server.js';\n");
console.log('Web runtime packaged: apps/web/.next/standalone (node server.js)');
