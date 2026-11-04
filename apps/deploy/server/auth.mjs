import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { readConfiguration } from '@vocespace/config-node';

const fingerprint = (value) => createHash('sha256').update(value).digest('hex');
export function sameToken(actual, expected) {
  if (typeof actual !== 'string' || !actual || typeof expected !== 'string' || !expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createAuth(configFile, now = Date.now) {
  const sessions = new Map();
  const attempts = new Map();
  const expected = () => {
    const token = readConfiguration({ file: configFile }).hostToken;
    if (!token?.trim()) throw new Error('配置中缺少 hostToken，无法登录。');
    return token;
  };
  function sessionId(request) {
    return /(?:^|;\s*)vocespace_deploy_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.cookie || '')?.[1];
  }
  function prune() {
    for (const [id, session] of sessions) if (session.until <= now()) sessions.delete(id);
    for (const [ip, attempt] of attempts) if (attempt.until <= now()) attempts.delete(ip);
  }
  return {
    checkConfiguration: expected,
    login(token, ip) {
      prune();
      const attempt = attempts.get(ip);
      if (attempt?.count >= 10) return { status: 429 };
      const configured = expected();
      if (!sameToken(token, configured)) {
        if (attempts.size >= 1000 && !attempt) attempts.delete(attempts.keys().next().value);
        attempts.set(ip, { count: (attempt?.count || 0) + 1, until: attempt?.until || now() + 60_000 });
        return { status: 401 };
      }
      attempts.delete(ip);
      if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value);
      const id = randomBytes(32).toString('hex');
      sessions.set(id, { fingerprint: fingerprint(configured), until: now() + 8 * 3600_000 });
      return { status: 200, id };
    },
    authorized(request) {
      prune();
      const id = sessionId(request);
      const session = sessions.get(id);
      if (!session) return false;
      if (session.fingerprint !== fingerprint(expected())) { sessions.delete(id); return false; }
      return true;
    },
    logout(request) { sessions.delete(sessionId(request)); },
  };
}
