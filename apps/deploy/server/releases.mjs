import fs from 'node:fs';
import path from 'node:path';
import { deploymentState, artifacts, validateManaged } from '../../../scripts/ubuntu/deploy-tools.mjs';

export const validVersion = (name) => typeof name === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(name);
export function releasePath(root, version) {
  if (!validVersion(version)) throw new Error('版本名只能包含字母、数字、点、横线和下划线，最多 80 字符。');
  const releases = path.join(root, 'releases');
  if (fs.realpathSync(releases) !== releases) throw new Error('releases 必须是部署目录内的实际目录。');
  const directory = path.join(releases, version);
  if (!fs.lstatSync(directory).isDirectory() || fs.lstatSync(directory).isSymbolicLink()) throw new Error('版本必须是 releases 内的普通目录。');
  return directory;
}
export function snapshot(root) {
  const state = deploymentState(root);
  const versions = fs.readdirSync(path.join(root, 'releases'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && validVersion(entry.name))
    .map(({ name }) => {
      const directory = path.join(root, 'releases', name);
      let meta;
      let ready = false;
      try {
        meta = JSON.parse(fs.readFileSync(path.join(directory, '.deploy.json'), 'utf8'));
        ready = meta.root === root && fs.existsSync(path.join(directory, '.deploy-ready'));
      } catch { /* Incomplete build remains visible and can be cleaned up. */ }
      const current = ['web', 'api', 'platform'].filter((project) => state[project].current === directory);
      const previous = ['web', 'api', 'platform'].filter((project) => state[project].previous === directory);
      const built = meta?.projects ?? (meta ? ['api', 'web'] : []);
      const projects = Array.isArray(built) ? built.filter((p) => ['web', 'api', 'platform'].includes(p)) : [];
      if (!projects.length) ready = false;
      if (ready) try { for (const project of projects) artifacts(directory, project); } catch { ready = false; }
      return { name, projects, ready, current, previous, protected: current.length > 0 || previous.length > 0,
        builtAt: typeof meta?.builtAt === 'string' ? meta.builtAt : fs.statSync(directory).mtime.toISOString() };
    }).sort((a, b) => b.builtAt.localeCompare(a.builtAt));
  return { projects: Object.fromEntries(['web', 'api', 'platform'].map((p) => [p, {
    current: state[p].current ? path.basename(state[p].current) : null,
    previous: state[p].previous ? path.basename(state[p].previous) : null,
  }])), versions };
}
export function removeRelease(root, version, processes) {
  const directory = releasePath(root, version);
  const state = deploymentState(root);
  validateManaged(processes, state);
  if (Object.values(state).some((entry) => entry.current === directory || entry.previous === directory)) {
    throw new Error('不能删除当前运行或保留用于回退的版本。');
  }
  for (const proc of processes) {
    for (const value of [proc.pm2_env?.pm_exec_path, proc.pm2_env?.pm_cwd]) {
      if (typeof value === 'string' && (path.resolve(value) === directory || path.resolve(value).startsWith(`${directory}/`))) {
        throw new Error('该版本仍被 PM2 进程引用，不能删除。');
      }
    }
  }
  const metadata = path.join(directory, '.deploy.json');
  if (fs.existsSync(metadata) && JSON.parse(fs.readFileSync(metadata, 'utf8')).root !== root) throw new Error('版本属于其他部署目录。');
  fs.rmSync(directory, { recursive: true });
}
export function verifyRollback(root, version, project) {
  const directory = releasePath(root, version);
  if (!fs.existsSync(path.join(directory, '.deploy-ready'))) throw new Error('只能回滚到构建完成的版本。');
  artifacts(directory, project);
}
