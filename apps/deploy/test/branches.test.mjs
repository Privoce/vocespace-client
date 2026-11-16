import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { listBranches, validBranch, repository } from '../server/branches.mjs';
import { validateAction } from '../server/jobs.mjs';
import { executeJob } from '../server/runner.mjs';

test('branch list uses the fixed repository and rejects upstream errors', async () => {
  const sha = 'a'.repeat(40);
  const result = await listBranches({ execute: async (cmd, args, options) => {
    assert.equal(cmd, 'git');
    assert.deepEqual(args, ['ls-remote', '--heads', repository]);
    assert.ok(options.timeout > 0);
    return { stdout: `${sha}\trefs/heads/main\n${sha}\trefs/heads/feature/rebuild\n${sha}\trefs/tags/v1\n` };
  } });
  assert.deepEqual(result.branches, ['feature/rebuild', 'main']);
  for (const execute of [async () => { throw new Error('secret upstream detail'); }, async () => ({ stdout: '' })]) {
    await assert.rejects(listBranches({ execute }), error => error.status === 502 && !error.message.includes('secret'));
  }
});

test('create/update require valid branches, while rollback/delete retain their original contract', () => {
  for (const branch of [undefined, '', '-main', '../main', 'a..b', 'a//b', 'a.lock', 'a/.b', 'a b', 'a\nb', 'a:b', 'a*', 'a@{b', 'a\\b']) {
    assert.equal(validBranch(branch), false);
    for (const action of ['create', 'update']) assert.throws(() => validateAction({ action, project: 'web', version: 'new', branch }), { status: 400 });
  }
  for (const branch of ['main', 'feature/rebuild', 'release/v1.2']) assert.equal(validBranch(branch), true);
  for (const action of ['rollback', 'delete']) {
    const input = { action, project: 'web', version: 'old' };
    assert.deepEqual(validateAction(input), input);
    assert.throws(() => validateAction({ ...input, branch: 'main' }), { status: 400 });
  }
});

test('real Git reset replaces divergent/dirty tracked files with the fetched branch; missing branch never builds', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-branch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'); const remote = path.join(root, 'remote.git');
  fs.mkdirSync(source);
  const git = (...args) => execFileSync('git', args, { cwd: source, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  fs.writeFileSync(path.join(source, 'tracked'), 'remote'); git('add', '.'); git('commit', '-m', 'base');
  git('branch', 'feature/target'); git('init', '--bare', remote); git('remote', 'add', 'origin', remote);
  git('push', 'origin', 'feature/target');
  const expected = git('rev-parse', 'HEAD').trim();
  fs.writeFileSync(path.join(source, 'tracked'), 'local commit'); git('commit', '-am', 'diverged');
  fs.writeFileSync(path.join(source, 'tracked'), 'dirty');
  const steps = [];
  const run = async (command, args) => {
    if (command === 'git') return args[0] === 'remote' ? repository : git(...args);
    steps.push(args[1]);
    assert.equal(git('rev-parse', 'HEAD').trim(), expected);
    assert.equal(fs.readFileSync(path.join(source, 'tracked'), 'utf8'), 'remote');
    return '';
  };
  const base = { root, source, run, log: { append() {} }, lockFd: 9 };
  await executeJob({ ...base, job: { action: 'update', project: 'web', version: 'new', branch: 'feature/target' } });
  assert.deepEqual(steps, ['build', 'activate']);
  steps.length = 0;
  await assert.rejects(executeJob({ ...base, job: { action: 'create', project: 'web', version: 'next', branch: 'missing' } }));
  assert.deepEqual(steps, []);
});
