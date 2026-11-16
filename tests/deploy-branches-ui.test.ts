// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { deployText } from '../packages/i18n/src/deploy.js';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); document.body.innerHTML = ''; });

it('requires a selected branch, sends it for create/update, and blocks publication on refresh failure', async () => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="app"></div>';
  const payloads: unknown[] = [];
  let branchFailure = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/jobs') payloads.push(JSON.parse(String(options?.body)));
    const error = url === '/api/branches' && branchFailure;
    const data = url === '/api/branches' ? { branches: ['main', 'feature/rebuild'] }
      : url === '/api/state' ? { active: null, jobs: [], versions: [], projects: { web: {}, api: {}, platform: {} } }
      : url === '/api/jobs' ? { id: 'fixture' } : {};
    return { ok: !error, status: error ? 502 : 200, json: async () => data };
  }));
  const script = fs.readFileSync('apps/deploy/client/app.js', 'utf8').replace(/^import .*;\n/, '');
  new Function('t', script)(deployText);
  const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  await flush();
  const branch = document.querySelector<HTMLSelectElement>('#branch')!;
  const publish = document.querySelector<HTMLButtonElement>('#publish')!;
  expect([...branch.options].map(option => option.value)).toEqual(['', 'main', 'feature/rebuild']);
  expect(publish.disabled).toBe(true);
  branch.value = 'feature/rebuild'; branch.dispatchEvent(new Event('change'));
  expect(publish.disabled).toBe(false);
  document.querySelector<HTMLInputElement>('#version')!.value = 'web-new';
  document.querySelector('#publish-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
  document.querySelector<HTMLButtonElement>('#update-mode')!.click();
  document.querySelector('#publish-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
  expect(payloads).toEqual(['create', 'update'].map(action => ({ action, project: 'web', version: 'web-new', branch: 'feature/rebuild' })));
  branchFailure = true;
  document.querySelector<HTMLButtonElement>('#refresh')!.click();
  await flush();
  expect(publish.disabled).toBe(true);
  expect(document.querySelector('#branch-status')!.textContent).toBe(deployText.branchError);
  window.dispatchEvent(new Event('pagehide'));
});
