import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

test('Mobile uses deploy config over development/public config, with cloud fallback and secret isolation', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-mobile-config-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const mobile = path.join(root, 'apps/mobile'); fs.mkdirSync(mobile, { recursive: true });
  const deployment = path.join(root, 'vocespace.deploy.conf.json');
  fs.writeFileSync(deployment, JSON.stringify({ hostToken: 'private-sentinel', deployment: { mobile: { apiUrl: 'https://deploy.invalid' } } }));
  fs.writeFileSync(path.join(root, 'vocespace.conf.json'), JSON.stringify({ deployment: { mobile: { apiUrl: 'https://dev.invalid' } } }));
  const publicFile = path.join(mobile, 'vocespace.public.json');
  fs.writeFileSync(publicFile, JSON.stringify({ mobile: { apiUrl: 'https://cloud.invalid' }, analytics: {}, hostToken: 'public-sentinel' }));
  const module = { exports: {} };
  new Function('require', '__dirname', 'module', fs.readFileSync('apps/mobile/app.config.js', 'utf8'))(
    createRequire(path.resolve('apps/mobile/app.config.js')), mobile, module,
  );
  const output = () => module.exports({ config: { extra: { eas: { projectId: 'fixture' } } } });
  assert.equal(output().extra.vocespace.mobile.apiUrl, 'https://deploy.invalid');
  assert.equal(output().extra.eas.projectId, 'fixture');
  assert.ok(!JSON.stringify(output()).includes('sentinel'));
  fs.unlinkSync(deployment);
  assert.equal(output().extra.vocespace.mobile.apiUrl, 'https://cloud.invalid');
  assert.ok(!JSON.stringify(output()).includes('sentinel'));
  fs.unlinkSync(publicFile);
  assert.throws(output, /ENOENT/);
});
