/** Ubuntu deployment helper. Never print environment values, config or PM2 jlist. */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';
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
export function configuration(release, root, env = process.env) {
  const webPort = port(env.WEB_PORT || '3030', 'WEB_PORT');
  const apiPort = port(env.API_PORT || '3031', 'API_PORT');
  if (webPort === apiPort) throw new Error('Web and API ports must differ');
  const basePath = env.NEXT_PUBLIC_BASE_PATH || '';
  if (basePath && !/^\/[A-Za-z0-9_/-]*[A-Za-z0-9_-]$/.test(basePath)) {
    throw new Error('NEXT_PUBLIC_BASE_PATH must be empty or a path without a trailing slash');
  }
  const common = {
    interpreter: process.execPath, exec_mode: 'fork', instances: 1,
    watch: false, autorestart: true, restart_delay: 3000, kill_timeout: 30000, time: true,
  };
  return { apps: [
    { ...common, name: 'vocespace-api', cwd: release,
      script: path.join(release, 'services/api/start.mjs'),
      env: { NODE_ENV: 'production', API_HOST: '127.0.0.1', API_PORT: String(apiPort),
        VOCESPACE_DATA_DIR: path.join(root, 'api-data'), WORKER_ENABLED: 'true' } },
    { ...common, name: 'vocespace-web', cwd: path.join(release, 'apps/web'),
      script: path.join(release, 'apps/web/server.js'),
      env: { NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(webPort),
        VOCESPACE_API_URL: `http://127.0.0.1:${apiPort}`, NEXT_PUBLIC_BASE_PATH: basePath,
        NEXT_PUBLIC_UMAMI_ENABLED: env.NEXT_PUBLIC_UMAMI_ENABLED === 'true' ? 'true' : 'false',
        NEXT_PUBLIC_UMAMI_URL: env.NEXT_PUBLIC_UMAMI_URL || 'https://rds.vocespace.com',
        NEXT_PUBLIC_UMAMI_WEBSITE_ID: env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || 'd2fe7209-e79d-45cc-8c0d-20b5f6035ce7' } },
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
function apiEnvironment(release, root) {
  const require = createRequire(path.join(release, 'services/api/package.json'));
  const dotenv = require('dotenv');
  const env = { ...process.env };
  for (const name of ['.env.local', '.env.production', '.env']) {
    const file = path.join(root, 'api-data', name);
    if (!fs.existsSync(file)) continue;
    if ((fs.statSync(file).mode & 0o077) !== 0) throw new Error(`Restrict permissions to 600: ${file}`);
    for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(file)))) {
      if (env[key] === undefined) env[key] = value;
    }
  }
  return env;
}
function existingConfig(root) {
  const file = path.join(root, 'api-data/vocespace.conf.json');
  if (!fs.existsSync(file)) return null;
  try { return readJson(file); } catch { throw new Error('Existing vocespace.conf.json is invalid; preserved without changes'); }
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
async function main([command, release, root, backup]) {
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
      const config = configuration(release, root);
      fs.writeFileSync(path.join(release, 'ecosystem.config.cjs'), `module.exports = ${JSON.stringify(config, null, 2)};\n`, { flag: 'wx' });
      fs.writeFileSync(path.join(release, '.deploy.json'), JSON.stringify({
        webPort: Number(config.apps[1].env.PORT), apiPort: Number(config.apps[0].env.API_PORT),
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
      const env = apiEnvironment(release, root);
      const origin = validUrl(env.PUBLIC_ORIGIN, 'PUBLIC_ORIGIN', ['https:', 'http:']);
      const account = validUrl(env.ACCOUNT_PUBLIC_URL, 'ACCOUNT_PUBLIC_URL', ['https:', 'http:']);
      if (origin.origin !== account.origin) throw new Error('PUBLIC_ORIGIN and ACCOUNT_PUBLIC_URL must share an origin');
      validUrl(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, 'SUPABASE_URL', ['https:', 'http:']);
      requireValue(env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY, 'SUPABASE_PUBLISHABLE_KEY');
      requireValue(env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
      const config = existingConfig(root);
      if (config) {
        redisConfig(config);
        validUrl(config.livekit?.url, 'livekit.url', ['wss:', 'ws:', 'https:', 'http:']);
        requireValue(config.livekit?.key, 'livekit.key');
        requireValue(config.livekit?.secret, 'livekit.secret');
        requireValue(config.hostToken, 'hostToken');
      } else {
        if (env.VOCESPACE_INIT_CONFIG !== 'true') throw new Error('Migrate the existing config/data, or explicitly enable VOCESPACE_INIT_CONFIG for a fresh installation');
        validUrl(env.LIVEKIT_URL, 'LIVEKIT_URL', ['wss:', 'ws:', 'https:', 'http:']);
        for (const key of ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'HOST_TOKEN']) requireValue(env[key], key);
        redisConfig({ redis: { enabled: true, host: env.REDIS_HOST || '127.0.0.1', port: env.REDIS_PORT || '6379', db: Number(env.REDIS_DB || 0) } });
      }
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
    case 'backup-redis': {
      const config = existingConfig(root);
      if (!config) { console.log('Fresh config: no previous Redis configuration to back up.'); break; }
      const redis = redisConfig(config);
      const file = path.join(backup, 'redis.rdb');
      // --rdb creates a replication snapshot of ALL Redis databases. Never stop Redis.
      const result = spawnSync('redis-cli', ['-h', redis.host, '-p', String(redis.port), '--rdb', file], {
        env: { ...process.env, REDISCLI_AUTH: redis.password || '' },
        stdio: ['ignore', 'ignore', 'ignore'], timeout: 300_000,
      });
      if (result.status !== 0 || !fs.existsSync(file) || fs.statSync(file).size === 0) {
        throw new Error('Redis snapshot failed. Check replication permissions or provide REDIS_BACKUP_HOOK; do not activate without a backup');
      }
      fs.chmodSync(file, 0o600);
      console.log('Redis snapshot saved (all databases; no restore performed).');
      break;
    }
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
