import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const repository = 'https://github.com/Privoce/vocespace-client.git';
const exec = promisify(execFile);

export function validBranch(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 &&
    !value.startsWith('-') && value !== '@' && !/[\x00-\x20\x7f~^:?*\[\\]/.test(value) &&
    !value.includes('..') && !value.includes('@{') && !value.endsWith('.') &&
    value.split('/').every((part) => part && !part.startsWith('.') && !part.endsWith('.lock'));
}

export function isProjectOrigin(value) {
  return /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)Privoce\/vocespace-client(?:\.git)?\/?$/i.test(value.trim());
}

export async function listBranches({ execute = exec } = {}) {
  try {
    const { stdout } = await execute('git', ['ls-remote', '--heads', repository], {
      timeout: 20_000, maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    const branches = [...new Set(stdout.split('\n').flatMap((line) => {
      const match = /^[a-f0-9]{40,64}\s+refs\/heads\/(.+)$/.exec(line.trim());
      return match && validBranch(match[1]) ? [match[1]] : [];
    }))].sort((a, b) => a.localeCompare(b));
    if (!branches.length) throw new Error('empty branch list');
    return { repository, branches };
  } catch {
    throw Object.assign(new Error('无法读取 GitHub 分支，请检查网络或仓库访问权限后刷新。'), { status: 502 });
  }
}
