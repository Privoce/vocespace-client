import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validVersion } from './releases.mjs';

export const terminal = (status) => ['succeeded', 'failed', 'interrupted'].includes(status);
export const validJobId = (id) => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
export function atomicJson(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, file);
}
export function validateAction(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((key) => !['action', 'project', 'version'].includes(key)) ||
      !['create', 'update', 'rollback', 'delete'].includes(input.action) ||
      !['web', 'api', 'platform'].includes(input.project) || !validVersion(input.version)) {
    throw Object.assign(new Error('请选择 Web 或 Server，并填写有效版本名（如 web-002）。'), { status: 400 });
  }
  return { action: input.action, project: input.project, version: input.version };
}
export function createJobStore({ root, source, launch = spawn }) {
  const directory = path.join(root, 'deploy-platform');
  const jobs = path.join(directory, 'jobs');
  const activeFile = path.join(directory, 'active.json');
  fs.mkdirSync(jobs, { recursive: true, mode: 0o700 });
  const jobFile = (id) => {
    if (!validJobId(id)) throw Object.assign(new Error('任务不存在。'), { status: 404 });
    return path.join(jobs, `${id}.json`);
  };
  const read = (id) => JSON.parse(fs.readFileSync(jobFile(id), 'utf8'));
  function recover() {
    if (!fs.existsSync(activeFile)) return null;
    const active = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
    const job = read(active.id);
    if (!terminal(job.status)) {
      try { process.kill(active.pid, 0); return job; }
      catch (error) {
        if (error.code !== 'ESRCH') throw error;
        job.status = 'interrupted';
        job.finishedAt = new Date().toISOString();
        job.error = '任务进程已退出；未自动重试。请先检查版本状态和日志。';
        atomicJson(jobFile(job.id), job);
      }
    }
    fs.unlinkSync(activeFile);
    return null;
  }
  return {
    start(input) {
      const action = validateAction(input);
      if (recover()) throw Object.assign(new Error('已有任务正在运行，请等待完成。'), { status: 409 });
      const id = randomUUID();
      // Reserve before spawning; a second platform instance cannot enqueue another job.
      try { fs.writeFileSync(activeFile, JSON.stringify({ id, pid: process.pid }), { flag: 'wx', mode: 0o600 }); }
      catch (error) { if (error.code === 'EEXIST') throw Object.assign(new Error('已有发布任务正在运行。'), { status: 409 }); throw error; }
      const job = { id, ...action, status: 'queued', createdAt: new Date().toISOString() };
      atomicJson(jobFile(id), job);
      try {
        const child = launch(process.execPath, [fileURLToPath(new URL('worker.mjs', import.meta.url)), root, source, id], {
          cwd: source, detached: true, stdio: 'ignore',
        });
        child.on('error', () => {
          const latest = read(id);
          if (!terminal(latest.status)) atomicJson(jobFile(id), { ...latest, status: 'failed', error: '无法启动任务进程。', finishedAt: new Date().toISOString() });
        });
        if (!child.pid) throw new Error('无法启动任务进程。');
        atomicJson(activeFile, { id, pid: child.pid });
        child.unref();
      } catch (error) {
        atomicJson(jobFile(id), { ...job, status: 'failed', error: '无法启动任务进程。', finishedAt: new Date().toISOString() });
        fs.rmSync(activeFile, { force: true });
        throw error;
      }
      return job;
    },
    list() {
      const active = recover();
      const history = fs.readdirSync(jobs).filter((file) => /^[a-f0-9-]{36}\.json$/.test(file))
        .map((file) => JSON.parse(fs.readFileSync(path.join(jobs, file), 'utf8')))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
      return { active: active?.id ?? null, jobs: history };
    },
    get(id) {
      recover();
      const job = read(id);
      const logFile = path.join(jobs, `${id}.log`);
      let log = '';
      if (fs.existsSync(logFile)) {
        const descriptor = fs.openSync(logFile, 'r');
        try {
          const length = fs.fstatSync(descriptor).size;
          const buffer = Buffer.alloc(Math.min(length, 128 * 1024));
          fs.readSync(descriptor, buffer, 0, buffer.length, Math.max(0, length - buffer.length));
          log = buffer.toString('utf8');
          if (length > buffer.length) log = '…仅显示最近 128 KiB 日志\n' + log.slice(log.indexOf('\n') + 1);
        } finally { fs.closeSync(descriptor); }
      }
      return { ...job, log };
    },
  };
}
