import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isBuiltin } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'services/api/dist');
await mkdir(output, { recursive: true });
await build({
  absWorkingDir: root, entryPoints: ['packages/domain/src/config.ts'],
  outfile: path.join(output, 'default-config.cjs'), bundle: true,
  platform: 'node', target: 'node24', format: 'cjs', logLevel: 'warning',
});
await build({
  absWorkingDir: root, entryPoints: ['services/api/preview/renderer.ts'],
  outfile: path.join(output, 'preview/renderer.js'), bundle: true,
  platform: 'browser', target: 'chrome100', minify: true, logLevel: 'warning',
});
const result = await build({
  absWorkingDir: root,
  entryPoints: ['services/api/entry.ts'], outfile: path.join(output, 'api.cjs'),
  bundle: true, platform: 'node', target: 'node24', format: 'cjs',
  packages: 'external', metafile: true, sourcemap: true,
  tsconfig: path.join(root, 'tsconfig.json'), logLevel: 'warning',
});
const runtimeImports = Object.values(result.metafile.outputs).flatMap((entry) => entry.imports);
const forbidden = runtimeImports.filter(({ path }) => /^(next|react|react-dom|antd)(\/|$)/.test(path));
if (forbidden.length) throw new Error(`Backend imports UI runtime: ${forbidden.map((x) => x.path)}`);
const manifest = JSON.parse(await readFile(path.join(root, 'services/api/package.json'), 'utf8'));
for (const { path: specifier } of runtimeImports) {
  const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  if (!isBuiltin(specifier) && !manifest.dependencies[packageName]) {
    throw new Error(`Undeclared API runtime dependency: ${specifier}`);
  }
}
await writeFile(path.join(output, 'api-meta.json'), JSON.stringify(result.metafile, null, 2));
// Prompts are code assets, separate from the mutable data directory.
await cp(path.join(root, 'services/api/prompt'), path.join(output, 'prompt'), {
  recursive: true, filter: (source) => !source.split(path.sep).includes('useless'),
});
console.log('Independent API built: services/api/dist/api.cjs');
