import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Build a source snapshot without touching the developer's .next, config, or data.
// This tests an unconfigured checkout, not a deployed instance.
const root = process.cwd();
const snapshot = fs.mkdtempSync(path.join(os.tmpdir(), 'vocespace-p0-build-'));
const entries = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  encoding: 'utf8',
}).split('\0');
const rootFiles = new Set([
  'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'next-env.d.ts',
  'next.config.cjs', 'server.js', '.eslintrc.json', 'vitest.config.ts',
]);
for (const file of new Set(entries)) {
  if (!file || (!rootFiles.has(file) && !/^(app|features|lib|server|styles|public|prompt|tests)\//.test(file))) continue;
  if (file.startsWith('lib/uploads/') || /(^|\/)\.env/.test(file)) continue;
  const source = path.join(root, file);
  if (!fs.existsSync(source) || !fs.lstatSync(source).isFile()) continue;
  const target = path.join(snapshot, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
fs.symlinkSync(path.join(root, 'node_modules'), path.join(snapshot, 'node_modules'), 'dir');
// Do not inherit deployed API keys or application settings from the calling shell.
const env = { NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=8192' };
for (const key of ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot']) {
  if (process.env[key]) env[key] = process.env[key];
}
console.log('P0 source snapshot:', snapshot);
console.log('Private env, config, upload state and existing .next are excluded.');
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build'], { cwd: snapshot, env, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
console.log('Snapshot retained for diagnosis:', snapshot);
process.exitCode = result.status ?? 1;
