import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { readConfiguration } from '@vocespace/config-node';
import { removeRelease, verifyRollback } from './releases.mjs';
import { validBranch, isProjectOrigin } from './branches.mjs';

export function createLog(file, config) {
  const secrets = [];
  function collect(value, sensitive = false) {
    if (typeof value === 'string' && sensitive && value) secrets.push(value);
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) collect(item, sensitive || /token|secret|password|key|credential/i.test(key));
    }
  }
  collect(config);
  const scrub = (text) => {
    for (const secret of secrets.sort((a, b) => b.length - a.length)) text = text.split(secret).join('[REDACTED]');
    return text.replace(/(https?:\/\/)[^\s/]+@/g, '$1[REDACTED]@').replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  };
  let bytes = 0;
  let capped = false;
  function append(line) {
    if (capped) return;
    const text = scrub(line) + '\n';
    bytes += Buffer.byteLength(text);
    if (bytes > 8 * 1024 * 1024) {
      capped = true;
      fs.appendFileSync(file, '\n日志已达到 8 MiB 上限；任务仍继续执行，请查看最终状态。\n', { mode: 0o600 });
      return;
    }
    fs.appendFileSync(file, text, { mode: 0o600 });
  }
  return {
    append,
    stream() {
      let pending = '';
      let discarded = false;
      return {
        write(chunk) {
          pending += chunk;
          let end;
          while ((end = pending.search(/[\r\n]/)) >= 0) {
            if (!discarded) append(pending.slice(0, end));
            pending = pending.slice(end + 1); discarded = false;
          }
          // Never emit a partial line: a credential can span output chunks.
          if (pending.length > 64 * 1024) { pending = ''; discarded = true; append('[单行日志过长，已省略]'); }
        },
        end() { if (pending && !discarded) append(pending); pending = ''; },
      };
    },
  };
}
export async function executeJob({ root, source, job, log, lockFd, run = runCommand }) {
  const script = path.join(source, 'scripts/ubuntu/deploy.sh');
  const invoke = (command, args, capture = false) => run(command, args, { cwd: source, log, lockFd, capture });
  if (['create', 'update'].includes(job.action)) {
    if (fs.existsSync(path.join(root, 'releases', job.version))) throw new Error('版本名称已存在，请填写新的版本号。');
    if (!validBranch(job.branch)) throw new Error('创建或更新发布必须选择有效分支。');
    const origin = await invoke('git', ['remote', 'get-url', 'origin'], true);
    if (!isProjectOrigin(origin)) throw new Error('源码 origin 必须指向 Privoce/vocespace-client。');
    log.append(`获取 origin/${job.branch}，然后 reset --hard 对齐远程源码（覆盖已跟踪文件的本地修改）…`);
    const remoteRef = `refs/remotes/origin/${job.branch}`;
    await invoke('git', ['fetch', '--no-tags', 'origin', `+refs/heads/${job.branch}:${remoteRef}`]);
    await invoke('git', ['reset', '--hard', remoteRef]);
    const commit = await invoke('git', ['rev-parse', 'HEAD'], true);
    log.append(`部署分支 ${job.branch} / 提交 ${commit.trim()}`);
    log.append(`构建 ${job.project} / ${job.version}`);
    await invoke('bash', [script, 'build', root, job.version, '-p', job.project]);
    log.append(`切换 ${job.project} / ${job.version}`);
    await invoke('bash', [script, 'activate', root, job.version, '-p', job.project]);
  } else if (job.action === 'rollback') {
    verifyRollback(root, job.version, job.project);
    log.append(`回滚 ${job.project} 至 ${job.version}`);
    await invoke('bash', [script, 'activate', root, job.version, '-p', job.project]);
  } else if (job.action === 'delete') {
    const raw = await invoke('pm2', ['jlist'], true);
    const start = raw.indexOf('[{') >= 0 ? raw.indexOf('[{') : raw.lastIndexOf('[]');
    const processes = JSON.parse(raw.slice(start));
    removeRelease(root, job.version, processes);
    log.append(`已删除旧版本 ${job.version}`);
  } else throw new Error('未知操作。');
}
export function runCommand(command, args, { cwd, log, lockFd, capture }) {
  return new Promise((resolve, reject) => {
    // Pass the already-held flock open file description as fd 9. No shell input
    // interpolation or user-provided command/path is accepted by the HTTP API.
    const stdio = ['ignore', 'pipe', 'pipe', 'ignore', 'ignore', 'ignore', 'ignore', 'ignore', 'ignore', lockFd];
    const child = spawn(command, args, { cwd, stdio, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', CI: 'true' } });
    const output = log.stream();
    const errors = log.stream();
    let result = '';
    let overflow = false;
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (!capture) output.write(chunk);
      else if (result.length + chunk.length < 8 * 1024 * 1024) result += chunk;
      else { overflow = true; child.kill('SIGTERM'); }
    });
    child.stderr.on('data', (chunk) => errors.write(chunk));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      output.end(); errors.end();
      if (code === 0 && !overflow) resolve(result);
      else reject(new Error(`${command} 执行失败（${overflow ? '输出过大' : signal || code}），请查看日志。`));
    });
  });
}
export function acquireDeploymentLock(root) {
  const descriptor = fs.openSync(path.join(root, '.deploy.lock'), 'a', 0o600);
  const result = spawnSync('flock', ['-n', '3'], { stdio: ['ignore', 'ignore', 'ignore', descriptor] });
  if (result.status !== 0) { fs.closeSync(descriptor); throw new Error('已有命令行或平台发布正在执行，请稍后再试。'); }
  return descriptor;
}
export const readRuntime = (root) => readConfiguration({ file: path.join(root, 'api-data/vocespace.conf.json') });
