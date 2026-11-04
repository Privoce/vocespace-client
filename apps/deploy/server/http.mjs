import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createAuth } from './auth.mjs';
import { createJobStore } from './jobs.mjs';
import { snapshot } from './releases.mjs';

async function body(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) throw Object.assign(new Error('需要 JSON 请求。'), { status: 415 });
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8192) throw Object.assign(new Error('请求内容过大。'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON 格式错误。'), { status: 400 }); }
}
export function createDeployServer({ root, source, assets, auth = createAuth(path.join(root, 'api-data/vocespace.conf.json')), store = createJobStore({ root, source }), readSnapshot = () => snapshot(root) }) {
  return http.createServer(async (request, response) => {
    const json = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const url = new URL(request.url, 'http://deploy.local');
      if (url.search) return json(400, { error: '接口不接受 URL 参数。' });
      const route = url.pathname;
      if (route.startsWith('/api/')) {
        const origin = request.headers.origin;
        if (request.headers['sec-fetch-site'] === 'cross-site' || (origin && (!/^https?:\/\//.test(origin) || new URL(origin).host !== request.headers.host))) {
          return json(403, { error: '不允许跨站操作。' });
        }
        if (request.method !== 'GET' && !origin) return json(403, { error: '缺少来源验证。' });
        if (route === '/api/login' && request.method === 'POST') {
          const input = await body(request);
          const login = auth.login(input?.hostToken, request.socket.remoteAddress);
          if (login.status !== 200) return json(login.status, { error: login.status === 429 ? '尝试过于频繁，请稍后重试。' : 'hostToken 不正确。' });
          response.setHeader('Set-Cookie', `vocespace_deploy_session=${login.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${origin.startsWith('https:') ? '; Secure' : ''}`);
          return json(200, { ok: true });
        }
        if (!auth.authorized(request)) return json(401, { error: '请先验证 hostToken。' });
        if (route === '/api/session' && request.method === 'GET') return json(200, { ok: true });
        if (route === '/api/logout' && request.method === 'POST') {
          auth.logout(request);
          response.setHeader('Set-Cookie', 'vocespace_deploy_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
          return json(200, { ok: true });
        }
        if (route === '/api/state' && request.method === 'GET') return json(200, { ...readSnapshot(), ...store.list() });
        if (route === '/api/jobs' && request.method === 'POST') return json(202, store.start(await body(request)));
        const job = /^\/api\/jobs\/([a-f0-9-]{36})$/.exec(route);
        if (job && request.method === 'GET') return json(200, store.get(job[1]));
        return json(404, { error: '接口不存在。' });
      }
      if (request.method !== 'GET') return json(405, { error: '不支持此操作。' });
      const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'] };
      const file = Object.hasOwn(files, route) ? files[route] : null;
      if (!file) return json(404, { error: '页面不存在。' });
      const contents = fs.readFileSync(path.join(assets, file[0]));
      response.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8` }); response.end(contents);
    } catch (error) {
      json(error.status || (error.code === 'ENOENT' ? 404 : 500), { error: error.status ? error.message : '无法完成请求，请检查服务器配置、版本状态和操作日志。' });
    }
  });
}
