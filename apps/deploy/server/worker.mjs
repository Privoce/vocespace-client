import fs from 'node:fs';
import path from 'node:path';
import { atomicJson, validateAction, validJobId } from './jobs.mjs';
import { createLog, executeJob, acquireDeploymentLock, readRuntime } from './runner.mjs';

const [root, source, id] = process.argv.slice(2);
if (!validJobId(id) || !path.isAbsolute(root || '') || !path.isAbsolute(source || '')) process.exit(1);
const directory = path.join(root, 'deploy-platform');
const file = path.join(directory, 'jobs', `${id}.json`);
const job = JSON.parse(fs.readFileSync(file, 'utf8'));
let lock;
let log;
try {
  validateAction({ action: job.action, project: job.project, version: job.version });
  log = createLog(path.join(directory, 'jobs', `${id}.log`), readRuntime(root));
  lock = acquireDeploymentLock(root);
  job.status = 'running'; job.startedAt = new Date().toISOString(); job.pid = process.pid;
  atomicJson(file, job);
  log.append(`[${job.startedAt}] ${job.action} ${job.project} ${job.version}`);
  await executeJob({ root, source, job, log, lockFd: lock });
  job.status = 'succeeded';
  log.append('操作完成。');
} catch (error) {
  job.status = 'failed';
  // Raw child stdout/stderr only reaches the redacting logger, not task metadata.
  job.error = '操作失败，请查看日志；未自动重试。';
  log?.append(error instanceof SyntaxError ? '部署状态 JSON 无法解析，请在服务器检查。' : error.message);
} finally {
  job.finishedAt = new Date().toISOString();
  atomicJson(file, job);
  if (lock !== undefined) fs.closeSync(lock);
  // The HTTP process observes the terminal status and releases its reservation.
}
