import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuth } from './auth.mjs';
import { createDeployServer } from './http.mjs';

const options = { root: '/var/vocespace/main', source: fileURLToPath(new URL('../../../', import.meta.url)), host: '0.0.0.0' };
const args = process.argv.slice(2).filter((arg) => arg !== '--');
for (let index = 0; index < args.length; index += 2) {
  const key = args[index].slice(2);
  if (!args[index].startsWith('--') || !Object.hasOwn(options, key) || !args[index + 1] || args[index + 1].startsWith('--')) {
    console.error('Usage: pnpm start:deploy --root /var/vocespace/main [--source /path/to/checkout] [--host 0.0.0.0]'); process.exit(1);
  }
  options[key] = args[index + 1];
}
try {
  options.root = fs.realpathSync(options.root); options.source = fs.realpathSync(options.source);
  if (options.root === options.source || options.root.startsWith(options.source + path.sep)) throw new Error('部署目录必须位于源码目录之外。');
  for (const file of ['scripts/ubuntu/deploy.sh', 'package.json']) fs.accessSync(path.join(options.source, file));
  for (const directory of ['releases', 'api-data']) fs.accessSync(path.join(options.root, directory));
  const assets = fileURLToPath(new URL('../dist/', import.meta.url));
  fs.accessSync(path.join(assets, 'index.html'));
  const auth = createAuth(path.join(options.root, 'api-data/vocespace.conf.json'));
  auth.checkConfiguration();
  const server = createDeployServer({ ...options, assets, auth });
  server.on('error', () => { console.error('Deploy 启动失败，请检查 4848 端口是否被占用。'); process.exitCode = 1; });
  server.listen(4848, options.host, () => console.log('VoceSpace Deploy listening on port 4848.'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    // Detached jobs and their global deployment lock survive a UI server restart.
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
} catch { console.error('Deploy 无法启动：请先 build:deploy，并检查源码路径、部署目录和 api-data/vocespace.conf.json 中的 hostToken。'); process.exitCode = 1; }
