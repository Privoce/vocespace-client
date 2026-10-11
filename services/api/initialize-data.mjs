import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

/** Opt-in first installation only. Existing configuration is never rewritten. */
export function initializeData(directory, env = process.env) {
  const configPath = path.join(directory, 'vocespace.conf.json');
  if (existsSync(configPath) || env.VOCESPACE_INIT_CONFIG !== 'true') return false;
  for (const key of ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'HOST_TOKEN', 'PUBLIC_ORIGIN']) {
    if (!env[key]?.trim()) throw new Error(`First installation requires ${key}`);
  }
  const origin = new URL(env.PUBLIC_ORIGIN);
  if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('PUBLIC_ORIGIN must be HTTP(S)');
  if (!['ws:', 'wss:', 'http:', 'https:'].includes(new URL(env.LIVEKIT_URL).protocol)) {
    throw new Error('LIVEKIT_URL must be a LiveKit HTTP(S)/WS(S) endpoint');
  }
  // Built with the API, so first-install defaults match existing application defaults.
  const { DEFAULT_VOCESPACE_CONFIG } = require('./dist/default-config.cjs');
  const config = {
    ...DEFAULT_VOCESPACE_CONFIG,
    livekit: { key: env.LIVEKIT_API_KEY, secret: env.LIVEKIT_API_SECRET, url: env.LIVEKIT_URL },
    hostToken: env.HOST_TOKEN,
    serverUrl: origin.hostname,
    redis: {
      enabled: true, host: env.REDIS_HOST || '127.0.0.1',
      port: Number(env.REDIS_PORT || 6379), db: Number(env.REDIS_DB || 0),
      password: env.REDIS_PASSWORD || '',
    },
  };
  if (!Number.isInteger(config.redis.port) || config.redis.port < 1 || config.redis.port > 65535 ||
      !Number.isInteger(config.redis.db) || config.redis.db < 0) throw new Error('Invalid Redis port/db');
  mkdirSync(directory, { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return true;
}
