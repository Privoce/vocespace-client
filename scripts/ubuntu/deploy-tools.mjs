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
export function validateManaged(processes, current) {
  for (const [name, entry] of [['vocespace-api', 'services/api/start.mjs'], ['vocespace-web', 'apps/web/server.js']]) {
    const old = typeof current === 'string' ? current : current[name.replace('vocespace-', '')]?.current;
    const matches = processes.filter((proc) => proc.name === name);
    if (!old && matches.length) throw new Error(`${name} already exists outside this deployment; migrate it manually first`);
    if (old && (matches.length !== 1 || matches[0].pm2_env?.pm_exec_path !== path.join(old, entry) ||
      matches[0].pm2_env?.exec_mode !== 'fork_mode')) {
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
  const meta = readJson(path.join(release, '.deploy.json'));
  for (const name of projects(only)) {
    const number = meta[`${name}Port`];
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
// Only long-running server workspaces belong here. Shared packages are built
// by their consumers; Mobile has a separate native release workflow.
const PROJECTS = ['api', 'web'];
export function projects(selection = 'all') {
  if (selection === 'all') return [...PROJECTS];
  const name = selection.replace(/^@vocespace\//, '');
  if (!PROJECTS.includes(name)) throw new Error(`Unknown deployable project: ${selection}`);
  return [name];
}
export function artifacts(release, selection = 'all') {
  const meta = readJson(path.join(release, '.deploy.json'));
  const built = meta.projects ?? PROJECTS; // Releases created before project selection.
  const files = ['ecosystem.config.cjs', '.deploy.json'];
  for (const project of projects(selection)) {
    if (!built.includes(project)) throw new Error(`Release was not built for ${project}`);
    files.push(...(project === 'api' ? [
      'services/api/dist/api.cjs', 'services/api/dist/default-config.cjs',
      'services/api/dist/preview/renderer.js', 'services/api/start.mjs',
    ] : ['apps/web/server.js', 'apps/web/.next/BUILD_ID']));
  }
  for (const file of files) {
    if (!fs.existsSync(path.join(release, file))) throw new Error(`Missing artifact: ${file}`);
  }
}
function completedRelease(root, release, project) {
  if (typeof release !== 'string' || path.dirname(release) !== path.join(root, 'releases') ||
      !fs.existsSync(path.join(release, '.deploy-ready')) || fs.lstatSync(release).isSymbolicLink()) {
    throw new Error(`${project}: release must be completed and directly inside ROOT/releases`);
  }
  artifacts(release, project);
  if (readJson(path.join(release, '.deploy.json')).root !== root) throw new Error('Release belongs to a different deployment root');
}
export function deploymentState(root) {
  // Validate legacy links even after migration; never remove a user directory.
  for (const name of ['current', 'previous']) {
    const file = path.join(root, name);
    if (fs.existsSync(file) && !fs.lstatSync(file).isSymbolicLink()) throw new Error(`${file} must be a release symlink`);
  }
  const file = path.join(root, '.deploy-state.json');
  let state;
  if (fs.existsSync(file)) {
    const data = readJson(file);
    if (data.version !== 1 || !data.projects) throw new Error('Invalid deployment state version');
    state = data.projects;
  } else {
    const link = (name) => {
      try { return fs.realpathSync(path.join(root, name)); }
      catch (error) {
        // A dangling pointer is not a fresh deployment.
        if (error.code !== 'ENOENT' || fs.lstatSync(path.join(root, name), { throwIfNoEntry: false })) throw new Error(`Invalid ${name} release link`);
        return null;
      }
    };
    const current = link('current');
    const previous = link('previous');
    state = Object.fromEntries(PROJECTS.map((name) => [name, { current, previous }]));
  }
  for (const project of PROJECTS) {
    if (!state[project] || !Object.hasOwn(state[project], 'current') || !Object.hasOwn(state[project], 'previous')) throw new Error('Invalid deployment project state');
    // Historical previous releases are validated when requested for rollback.
    if (state[project].current !== null) completedRelease(root, state[project].current, project);
    const previous = state[project].previous;
    if (previous !== null && (typeof previous !== 'string' || path.dirname(previous) !== path.join(root, 'releases'))) throw new Error('Invalid previous release path');
  }
  return state;
}
function managed(state) {
  const result = spawnSync('pm2', ['jlist'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Unable to inspect PM2 processes');
  const json = result.stdout.slice(result.stdout.indexOf('[{') >= 0 ? result.stdout.indexOf('[{') : result.stdout.lastIndexOf('[]'));
  validateManaged(JSON.parse(json), state);
}
function preflight(release, root) {
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
}
function activationPlan(root, command, release, selection) {
  if (!['activate', 'rollback'].includes(command)) throw new Error('Invalid activation command');
  const state = deploymentState(root);
  const selected = projects(selection);
  const changes = [];
  const next = structuredClone(state);
  for (const project of selected) {
    const old = state[project].current;
    const target = command === 'rollback' ? state[project].previous : path.join(root, 'releases', release);
    if (!target) throw new Error(`${project}: no previous release`);
    completedRelease(root, target, project);
    if (target === old) {
      if (selected.length === 1) throw new Error('This release is already current');
      continue;
    }
    preflight(target, root);
    changes.push({ project, old, target });
    next[project] = { current: target, previous: old };
  }
  if (!changes.length) throw new Error('This release is already current');
  for (const project of PROJECTS) {
    // A partial update cannot silently change the peer's ports/basePath.
    if (!changes.some((change) => change.project === project) && state[project].current) preflight(state[project].current, root);
  }
  managed(state);
  return { root, changes, next: { version: 1, projects: next } };
}
function commitPlan(plan) {
  const { root, next } = plan;
  const temporary = path.join(root, '.deploy-state.new');
  fs.writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temporary, path.join(root, '.deploy-state.json'));
  // State above is authoritative and atomic. Legacy links are convenience views
  // only when BOTH services share a version; omit misleading links for mixed releases.
  for (const kind of ['current', 'previous']) {
    try {
      const values = PROJECTS.map((name) => next.projects[name][kind]);
      const link = path.join(root, kind);
      if (values[0] && values.every((value) => value === values[0])) {
        const temp = path.join(root, `.${kind}.new`);
        fs.rmSync(temp, { force: true });
        fs.symlinkSync(values[0], temp);
        fs.renameSync(temp, link);
      } else if (fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) fs.unlinkSync(link);
    } catch { console.error(`State saved; could not refresh legacy ${kind} link. Use deploy.sh status.`); }
  }
}
async function main([command, release, root, selection, extra]) {
  switch (command) {
    case 'manifests':
      for (const parent of ['apps', 'services']) {
        for (const entry of fs.readdirSync(path.join(release, parent), { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const manifest = path.join(release, parent, entry.name, 'package.json');
          if (!fs.existsSync(manifest)) continue;
          fs.mkdirSync(path.join(root, parent, entry.name), { recursive: true });
          fs.copyFileSync(manifest, path.join(root, parent, entry.name, 'package.json'));
        }
      }
      break;
    case 'plan': console.log(JSON.stringify(activationPlan(release, root, selection, extra))); break;
    case 'rows':
      for (const { project, old, target } of readJson(release).changes) console.log([project, old ?? '-', target].join('\t'));
      break;
    case 'commit': commitPlan(readJson(release)); break;
    case 'status': {
      const state = deploymentState(release);
      for (const project of projects(root)) console.log([project, state[project].current ?? '-', state[project].previous ?? '-'].join('\t'));
      break;
    }
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
      const selected = projects(selection);
      const config = configuration(release, root, runtime);
      config.apps = config.apps.filter((app) => selected.includes(app.name.replace('vocespace-', '')));
      if (selected.includes('web')) fs.writeFileSync(path.join(release, 'apps/web/vocespace.build.json'), JSON.stringify({ deployment: { basePath: runtime.deployment.basePath } }), { flag: 'wx' });
      fs.writeFileSync(path.join(release, 'ecosystem.config.cjs'), `module.exports = ${JSON.stringify(config, null, 2)};\n`, { flag: 'wx' });
      fs.writeFileSync(path.join(release, '.deploy.json'), JSON.stringify({
        webPort: runtime.deployment.web.port, apiPort: runtime.deployment.api.port, basePath: runtime.deployment.basePath,
        root, projects: selected, node: process.versions.node, builtAt: new Date().toISOString(),
      }, null, 2), { flag: 'wx' });
      break;
    }
    case 'artifacts': artifacts(release, root); break;
    case 'preflight': preflight(release, root); break;
    case 'managed': managed(release); break;
    case 'ports': {
      const meta = readJson(path.join(release, '.deploy.json'));
      for (const project of projects(root)) await freePort(port(meta[`${project}Port`], `${project} port`));
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
