/** Ubuntu deployment helper. Never print environment values, config or PM2 jlist. */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { readConfiguration } from '../../packages/config-node/index.cjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
function requireValue(value, name) {
  if (typeof value !== 'string' || !value.trim() || /填写|example\.(com|test)|^<.*>$/.test(value)) {
    throw new Error(`Missing/placeholder configuration: ${name}`);
  }
  return value;
}
function validUrl(value, name, schemes) {
  requireValue(value, name);
  let url;
  try { url = new URL(value); } catch { throw new Error(`Invalid URL: ${name}`); }
  if (!schemes.includes(url.protocol)) throw new Error(`Invalid protocol: ${name}`);
  return url;
}
export function port(value, name) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error(`Invalid port: ${name}`);
  }
  return Number(value);
}
export function configuration(release, root, conf = readConfiguration({ file: path.join(root, 'api-data/vocespace.conf.json') })) {
  const webPort = port(conf.deployment.web.port, 'deployment.web.port');
  const apiPort = port(conf.deployment.api.port, 'deployment.api.port');
  if (webPort === apiPort) throw new Error('Web and API ports must differ');
  const common = {
    interpreter: process.execPath, exec_mode: 'fork', instances: 1,
    watch: false, autorestart: true, restart_delay: 3000, kill_timeout: 30000, time: true,
    args: ['--config', path.join(root, 'api-data/vocespace.conf.json')],
    env: { NODE_ENV: 'production' },
  };
  return { apps: [
    { ...common, name: 'vocespace-api', cwd: release, script: path.join(release, 'services/api/start.mjs') },
    { ...common, name: 'vocespace-web', cwd: path.join(release, 'apps/web'), script: path.join(release, 'apps/web/server.js') },
  ] };
}
export function validateManaged(processes, old) {
  for (const [name, entry] of [['vocespace-api', 'services/api/start.mjs'], ['vocespace-web', 'apps/web/server.js']]) {
    const matches = processes.filter((proc) => proc.name === name);
    if (!old && matches.length) throw new Error(`${name} already exists outside this deployment; migrate it manually first`);
    if (old && (matches.length !== 1 || matches[0].pm2_env.pm_exec_path !== path.join(old, entry) ||
      matches[0].pm2_env.exec_mode !== 'fork_mode')) {
      throw new Error(`${name} does not match the current release/single fork process; inspect PM2 before proceeding`);
    }
  }
}
function redisConfig(config) {
  if (!config.redis?.enabled) throw new Error('Redis must be enabled in vocespace.conf.json');
  requireValue(config.redis.host, 'redis.host');
  port(config.redis.port, 'redis.port');
  if (!Number.isInteger(config.redis.db) || config.redis.db < 0) throw new Error('Invalid redis.db');
  return config.redis;
}
async function freePort(number) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Port ${number} is occupied; stop the known old application manually`)));
    server.listen(number, '127.0.0.1', () => server.close(resolve));
  });
}
async function health(release, only) {
  const { webPort, apiPort } = readJson(path.join(release, '.deploy.json'));
  for (const [name, number] of [['api', apiPort], ...(only === 'api' ? [] : [['web', webPort]])]) {
    let ok = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port(number, name)}/healthz`, { signal: AbortSignal.timeout(2000) });
        const body = await response.json();
        ok = response.ok && body.status === 'ok' && (name === 'web' ? body.service === 'web' : body.apiVersion === 1);
      } catch { /* Retry only liveness, never a write endpoint. */ }
      if (ok) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!ok) throw new Error(`${name} health check failed; inspect local PM2 logs`);
    console.log(`${name}: healthy (127.0.0.1:${number})`);
  }
}
async function main([command, release, root]) {
  switch (command) {
    case 'versions': {
      const version = fs.readFileSync(path.join(release, '.nvmrc'), 'utf8').trim();
      if (process.versions.node !== version) throw new Error(`Use Node ${version}; source ROOT/tools/env.sh`);
      const pnpm = spawnSync('pnpm', ['--version'], { encoding: 'utf8' });
      if (`pnpm@${pnpm.stdout?.trim()}` !== readJson(path.join(release, 'package.json')).packageManager) {
        throw new Error('pnpm version does not match packageManager; run setup.sh');
      }
      break;
    }
    case 'configure': {
      const runtime = readConfiguration({ file: path.join(root, 'api-data/vocespace.conf.json') });
      const config = configuration(release, root, runtime);
      fs.writeFileSync(path.join(release, 'apps/web/vocespace.build.json'), JSON.stringify({ deployment: { basePath: runtime.deployment.basePath } }), { flag: 'wx' });
      fs.writeFileSync(path.join(release, 'ecosystem.config.cjs'), `module.exports = ${JSON.stringify(config, null, 2)};\n`, { flag: 'wx' });
      fs.writeFileSync(path.join(release, '.deploy.json'), JSON.stringify({
        webPort: runtime.deployment.web.port, apiPort: runtime.deployment.api.port, basePath: runtime.deployment.basePath,
        root, node: process.versions.node, builtAt: new Date().toISOString(),
      }, null, 2), { flag: 'wx' });
      break;
    }
    case 'artifacts':
      for (const file of ['services/api/dist/api.cjs', 'services/api/dist/default-config.cjs',
        'services/api/dist/preview/renderer.js', 'services/api/start.mjs', 'apps/web/server.js',
        'apps/web/.next/BUILD_ID', 'ecosystem.config.cjs', '.deploy.json']) {
        if (!fs.existsSync(path.join(release, file))) throw new Error(`Missing artifact: ${file}`);
      }
      break;
    case 'preflight': {
      if (readJson(path.join(release, '.deploy.json')).root !== root) throw new Error('Release belongs to a different deployment root');
      const config = readConfiguration({ file: path.join(root, 'api-data/vocespace.conf.json') });
      const origin = validUrl(config.deployment.publicOrigin, 'deployment.publicOrigin', ['https:', 'http:']);
      const account = validUrl(config.account.publicUrl || config.deployment.publicOrigin, 'account.publicUrl', ['https:', 'http:']);
      if (origin.origin !== account.origin) throw new Error('Account and public deployment URLs must share an origin');
      validUrl(config.account.supabase.url, 'account.supabase.url', ['https:']);
      requireValue(config.account.supabase.publishableKey, 'account.supabase.publishableKey');
      requireValue(config.account.supabase.serviceRoleKey, 'account.supabase.serviceRoleKey');
      if (path.resolve(root, 'api-data', config.deployment.dataDir) !== path.join(root, 'api-data')) throw new Error('Ubuntu scripts require deployment.dataDir to resolve to ROOT/api-data');
      const meta = readJson(path.join(release, '.deploy.json'));
      if (meta.webPort !== config.deployment.web.port || meta.apiPort !== config.deployment.api.port || meta.basePath !== config.deployment.basePath) throw new Error('Deployment ports/basePath differ from release metadata; build a new release');
      redisConfig(config);
      validUrl(config.livekit?.url, 'livekit.url', ['wss:', 'ws:', 'https:', 'http:']);
      requireValue(config.livekit?.key, 'livekit.key');
      requireValue(config.livekit?.secret, 'livekit.secret');
      requireValue(config.hostToken, 'hostToken');
      console.log('API configuration validated (values hidden).');
      break;
    }
    case 'managed': {
      const result = spawnSync('pm2', ['jlist'], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error('Unable to inspect PM2 processes');
      // Some PM2 versions print daemon startup lines before the JSON array.
      const json = result.stdout.slice(result.stdout.indexOf('[{') >= 0 ? result.stdout.indexOf('[{') : result.stdout.lastIndexOf('[]'));
      validateManaged(JSON.parse(json), release);
      break;
    }
    case 'ports': {
      const meta = readJson(path.join(release, '.deploy.json'));
      await freePort(port(meta.apiPort, 'API_PORT'));
      await freePort(port(meta.webPort, 'WEB_PORT'));
      break;
    }
    case 'health': await health(release, root); break;
    default: throw new Error('Unknown deployment helper command');
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    // Avoid serializing request objects, config, or child-process environment.
    console.error(error instanceof SyntaxError ? 'Invalid JSON in deployment state/configuration; inspect locally.' : error.message);
    process.exitCode = 1;
  });
}
