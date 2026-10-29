/** Server/build tooling only. Never import this package from browser or Native code. */
const fs = require('node:fs');
const path = require('node:path');
let defaults;
try { defaults = require('@vocespace/domain/runtime-defaults.json'); }
catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  // Source checkout before pnpm install (Ubuntu init/build helper).
  defaults = require('../domain/src/runtime-defaults.json');
}
const stateKey = Symbol.for('vocespace.configuration.path');
function configPath(file) {
  if (file) return path.resolve(file);
  if (globalThis[stateKey]) return globalThis[stateKey];
  const option = process.argv.indexOf('--config');
  if (option >= 0) {
    if (!process.argv[option + 1] || process.argv[option + 1].startsWith('--')) throw new Error('--config requires a JSON path');
    return path.resolve(process.argv[option + 1]);
  }
  let directory = process.cwd();
  for (;;) {
    const candidate = path.join(directory, 'vocespace.conf.json');
    if (fs.existsSync(candidate)) return candidate;
    if (fs.existsSync(path.join(directory, 'pnpm-workspace.yaml'))) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) return path.join(process.cwd(), 'vocespace.conf.json');
    directory = parent;
  }
}
function setConfigPath(file) {
  globalThis[stateKey] = path.resolve(file);
  return globalThis[stateKey];
}
function mergeDefaults(base, value, name = '') {
  if (value === undefined) return structuredClone(base);
  if (base && typeof base === 'object' && !Array.isArray(base)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid configuration field: ${name}`);
    const result = { ...value };
    for (const [key, item] of Object.entries(base)) result[key] = mergeDefaults(item, value[key], name ? `${name}.${key}` : key);
    return result;
  }
  if (typeof value !== typeof base) throw new Error(`Invalid configuration field: ${name}`);
  return value;
}
function normalizeConfiguration(value) {
  const conf = mergeDefaults(defaults, value);
  for (const [name, port] of [['api', conf.deployment.api.port], ['web', conf.deployment.web.port]]) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid deployment.${name}.port`);
  }
  for (const [name, value] of [['api.uploadLimitBytes', conf.deployment.api.uploadLimitBytes], ['preview.maxSources', conf.preview.maxSources]]) {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`Invalid ${name}`);
  }
  if (conf.deployment.basePath && !/^\/[A-Za-z0-9_/-]*[A-Za-z0-9_-]$/.test(conf.deployment.basePath)) throw new Error('Invalid deployment.basePath');
  for (const [name, value] of [
    ['deployment.publicOrigin', conf.deployment.publicOrigin], ['deployment.web.apiUrl', conf.deployment.web.apiUrl],
    ['deployment.mobile.apiUrl', conf.deployment.mobile.apiUrl], ['account.publicUrl', conf.account.publicUrl],
    ['account.supabase.url', conf.account.supabase.url], ['preview.rendererBaseUrl', conf.preview.rendererBaseUrl],
    ['preview.s3Endpoint', conf.preview.s3Endpoint], ['analytics.url', conf.analytics.url], ['billing.stripe.siteUrl', conf.billing.stripe.siteUrl],
  ]) {
    if (!value) continue;
    let url;
    try { url = new URL(value); } catch { throw new Error(`Invalid configuration URL: ${name}`); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error(`Invalid configuration URL: ${name}`);
  }
  if (new URL(conf.deployment.publicOrigin).pathname !== '/') throw new Error('deployment.publicOrigin must be an origin; use deployment.basePath for paths');
  return conf;
}
function readConfiguration(options = {}) {
  const file = configPath(options.file);
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    if (options.optional && error.code === 'ENOENT') return normalizeConfiguration({});
    // No JSON contents, request objects or secret values in diagnostics.
    throw new Error(`Cannot read configuration JSON: ${file}`);
  }
  return normalizeConfiguration(value);
}
function publicConfiguration(conf) {
  // Explicit allowlist: never spread a private section into client payloads.
  return {
    basePath: conf.deployment.basePath,
    mobile: { apiUrl: conf.deployment.mobile.apiUrl, meetingUiPreview: conf.deployment.mobile.meetingUiPreview },
    analytics: { enabled: conf.analytics.enabled, url: conf.analytics.url, websiteId: conf.analytics.websiteId },
    debug: { datadogClientToken: conf.debug.datadogClientToken, datadogSite: conf.debug.datadogSite },
  };
}
module.exports = { configPath, setConfigPath, readConfiguration, normalizeConfiguration, publicConfiguration };
