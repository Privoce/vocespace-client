import { build } from 'esbuild';
import { cp, mkdir, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
for (const file of await readdir(new URL('server/', import.meta.url))) {
  if (file.endsWith('.mjs') && spawnSync(process.execPath, ['--check', `${root}server/${file}`], { stdio: 'inherit' }).status !== 0) process.exit(1);
}
await mkdir(`${root}dist`, { recursive: true });
await build({ entryPoints: [`${root}client/app.js`], outfile: `${root}dist/app.js`, bundle: true, format: 'esm', platform: 'browser', target: ['es2022'], minify: true });
for (const file of ['index.html', 'styles.css']) await cp(`${root}client/${file}`, `${root}dist/${file}`);
console.log('Deploy UI built; start with pnpm start:deploy --root /var/vocespace/main (port 4848).');
