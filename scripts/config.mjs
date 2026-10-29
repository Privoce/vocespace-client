/** Explicit one-time migration/build tool. Runtime never loads .env files. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { normalizeConfiguration, publicConfiguration } from '@vocespace/config-node';
const args = process.argv.slice(2);
const command = args.shift();
function option(name) { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; }
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.resolve(option('--config') || 'vocespace.conf.json');
const mappings = {
  PUBLIC_ORIGIN: 'deployment.publicOrigin', NEXT_PUBLIC_BASE_PATH: 'deployment.basePath',
  VOCESPACE_DATA_DIR: 'deployment.dataDir', API_HOST: 'deployment.api.host', API_PORT: 'deployment.api.port',
  API_UPLOAD_LIMIT_BYTES: 'deployment.api.uploadLimitBytes', WORKER_ENABLED: 'deployment.api.workerEnabled',
  VOCESPACE_PROMPT_DIR: 'deployment.api.promptDir', VOCESPACE_PREVIEW_ASSETS: 'deployment.api.previewAssetsDir',
  HOST: 'deployment.web.host', PORT: 'deployment.web.port', WEB_PORT: 'deployment.web.port',
  VOCESPACE_API_URL: 'deployment.web.apiUrl', EXPO_PUBLIC_API_URL: 'deployment.mobile.apiUrl',
  EXPO_PUBLIC_MEETING_UI_PREVIEW: 'deployment.mobile.meetingUiPreview',
  ACCOUNT_PUBLIC_URL: 'account.publicUrl', SUPABASE_URL: 'account.supabase.url', NEXT_PUBLIC_SUPABASE_URL: 'account.supabase.url',
  SUPABASE_PUBLISHABLE_KEY: 'account.supabase.publishableKey', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY: 'account.supabase.publishableKey',
  SUPABASE_SERVICE_ROLE_KEY: 'account.supabase.serviceRoleKey', PLATFORM_JWT_SECRET: 'account.platformJwtSecret',
  LICENSE_SECRET: 'billing.licenseSecret', WEBHOOK: 'billing.stripe.enabled', STRIPE_SECRET_KEY: 'billing.stripe.secretKey',
  STRIPE_WEBHOOK_SECRET: 'billing.stripe.webhookSecret', SITE_URL: 'billing.stripe.siteUrl',
  PREVIEW_ENABLED: 'preview.enabled', PREVIEW_RENDERER_BASE_URL: 'preview.rendererBaseUrl',
  PREVIEW_MAX_SOURCES: 'preview.maxSources', PREVIEW_S3_ENDPOINT: 'preview.s3Endpoint',
  NEXT_PUBLIC_UMAMI_ENABLED: 'analytics.enabled', NEXT_PUBLIC_UMAMI_URL: 'analytics.url', NEXT_PUBLIC_UMAMI_WEBSITE_ID: 'analytics.websiteId',
  EXPO_PUBLIC_UMAMI_ENABLED: 'analytics.enabled', EXPO_PUBLIC_UMAMI_URL: 'analytics.url', EXPO_PUBLIC_UMAMI_WEBSITE_ID: 'analytics.websiteId',
  NEXT_PUBLIC_DATADOG_CLIENT_TOKEN: 'debug.datadogClientToken', NEXT_PUBLIC_DATADOG_SITE: 'debug.datadogSite',
  LIVEKIT_URL: 'livekit.url', LIVEKIT_API_KEY: 'livekit.key', LIVEKIT_API_SECRET: 'livekit.secret', HOST_TOKEN: 'hostToken',
  REDIS_ENABLED: 'redis.enabled', REDIS_HOST: 'redis.host', REDIS_PORT: 'redis.port', REDIS_DB: 'redis.db', REDIS_PASSWORD: 'redis.password',
  SMTP_HOST: 'smtp.host', SMTP_PORT: 'smtp.port', SMTP_SECURE: 'smtp.secure', SMTP_USER: 'smtp.user', SMTP_PASS: 'smtp.pass', SMTP_FROM: 'smtp.from',
  HYPERBEAM_API_KEY: 'hyperbeam.apiKey', HYPERBEAM_API_BASE: 'hyperbeam.apiBase', HYPERBEAM_DEFAULT_START_URL: 'hyperbeam.defaultStartUrl',
  S3_ACCESS_KEY: 's3.accessKey', S3_KEY_ID: 's3.accessKey', S3_SECRET_KEY: 's3.secretKey', S3_KEY_SECRET: 's3.secretKey', S3_BUCKET: 's3.bucket', S3_REGION: 's3.region',
};
const numeric = new Set(['API_PORT', 'PORT', 'WEB_PORT', 'API_UPLOAD_LIMIT_BYTES', 'PREVIEW_MAX_SOURCES', 'REDIS_PORT', 'REDIS_DB', 'SMTP_PORT']);
const boolean = new Set(['WORKER_ENABLED', 'WEBHOOK', 'PREVIEW_ENABLED', 'NEXT_PUBLIC_UMAMI_ENABLED', 'EXPO_PUBLIC_UMAMI_ENABLED', 'EXPO_PUBLIC_MEETING_UI_PREVIEW', 'REDIS_ENABLED', 'SMTP_SECURE']);
function assignMissing(conf, dotted, value) {
  const parts = dotted.split('.'); let target = conf;
  for (const key of parts.slice(0, -1)) target = target[key] ??= {};
  const key = parts.at(-1);
  if (target[key] === undefined) target[key] = value;
}
try {
  if (command === 'init') {
    const example = fs.readFileSync(path.join(repository, 'vocespace.conf.example.json'));
    fs.writeFileSync(file, example, { flag: 'wx', mode: 0o600 });
    console.log('Created JSON template. Fill credentials and deployment addresses before startup.');
  } else if (command === 'migrate') {
    const source = path.resolve(option('--from') || file);
    const conf = JSON.parse(fs.readFileSync(source, 'utf8'));
    const env = {};
    for (let i = 0; i < args.length; i++) if (args[i] === '--env') {
      // Earlier file wins, matching the old .env.local > .env.production > .env order.
      const next = parse(fs.readFileSync(args[++i]));
      for (const [key, value] of Object.entries(next)) if (env[key] === undefined) env[key] = value;
    }
    for (const [key, dotted] of Object.entries(mappings)) if (env[key] !== undefined) {
      let value = env[key];
      if (numeric.has(key)) value = Number(value);
      if (boolean.has(key)) {
        if (!['true', 'false', '1', '0', ''].includes(value)) throw new Error(`Invalid boolean: ${key}`);
        value = value === 'true' || value === '1';
      }
      assignMissing(conf, dotted, value);
    }
    if (!conf.livekit?.turn && env.TURN_URL) {
      conf.livekit ??= {};
      conf.livekit.turn = [{ urls: env.TURN_URL, username: env.TURN_USERNAME || '', credential: env.TURN_CREDENTIAL || '' }];
    }
    if (!conf.deployment?.publicOrigin && conf.account?.publicUrl) assignMissing(conf, 'deployment.publicOrigin', new URL(conf.account.publicUrl).origin);
    // Preserve old installations that issued licenses using the legacy default.
    assignMissing(conf, 'billing.licenseSecret', 'privoce_vocespace_secret_key');
    const resolved = normalizeConfiguration(conf);
    const backup = `${file}.backup-${Date.now()}`;
    if (fs.existsSync(file)) fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
    if (fs.existsSync(backup)) fs.chmodSync(backup, 0o600);
    const temporary = `${file}.migrating-${process.pid}`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(resolved, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, file);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
    console.log('Migrated configuration; existing JSON fields preserved, backup retained. No secret values printed.');
  } else if (command === 'public' || command === 'web-build') {
    const conf = normalizeConfiguration(JSON.parse(fs.readFileSync(file, 'utf8')));
    const target = path.resolve(option('--output') || (command === 'public' ? 'apps/mobile/vocespace.public.json' : 'apps/web/vocespace.build.json'));
    fs.writeFileSync(target, JSON.stringify(command === 'public' ? publicConfiguration(conf) : { deployment: { basePath: conf.deployment.basePath } }, null, 2) + '\n');
    console.log('Public client configuration exported (no service credentials).');
  } else if (command === 'check') {
    normalizeConfiguration(JSON.parse(fs.readFileSync(file, 'utf8')));
    console.log('JSON configuration structure validated (values hidden).');
  } else throw new Error('Usage: config.mjs init|migrate|public|web-build|check --config FILE [--from JSON] [--env FILE ...] [--output FILE]');
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Invalid JSON; original configuration preserved.' : error.message);
  process.exitCode = 1;
}
