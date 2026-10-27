import { createHash, randomBytes } from 'node:crypto';
import { accountObject, accountString } from '@vocespace/contracts';
import { AccountError, type createAccountService } from '@vocespace/server-core';
import { ApiRequest, ApiResponse } from '../http';
import { accountFlows } from './flow-store';

const cookieName = 'vocespace_account_deletion';
const ttl = 600;
type Service = ReturnType<typeof createAccountService>;

/** An opaque, short-lived browser session dedicated to account deletion. */
export async function webAccountEndpoint(
  request: ApiRequest,
  action: string,
  body: unknown,
  service: Service,
  base: URL,
) {
  if (request.headers.get('origin') !== base.origin ||
      request.headers.get('x-vocespace-request') !== '1' ||
      request.headers.get('sec-fetch-site') === 'cross-site')
    throw new AccountError(403, 'ORIGIN_DENIED');
  const ticket = request.cookies.get(cookieName)?.value || '';
  const cookie = (value: string, age: number) =>
    `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=${base.pathname}api/; Max-Age=${age}${base.protocol === 'https:' ? '; Secure' : ''}`;
  const json = (value: unknown, clear = false) => ApiResponse.json(value, {
    headers: clear ? { 'Set-Cookie': cookie('', 0) } : {},
  });
  const input = accountObject(body);
  if (!['web-login', 'web-session', 'web-delete', 'web-logout'].includes(action))
    throw new AccountError(404, 'NOT_FOUND');
  const identity = action === 'web-login'
    ? accountString(input.email, 254).trim().toLowerCase() : ticket;
  const hash = createHash('sha256').update(identity).digest('hex');
  if (!(await accountFlows.allow('global', 200)) ||
      !(await accountFlows.allow(`${action}:${hash}`, 10)))
    throw new AccountError(429, 'AUTH_RATE_LIMITED');

  if (action === 'web-login') {
    const auth = await service.login(body);
    const next = randomBytes(32).toString('hex');
    try {
      await accountFlows.write(next, { kind: 'account-deletion', token: auth.accessToken }, ttl);
    } catch (error) {
      await service.logout(auth.accessToken).catch(() => undefined);
      throw error;
    }
    return ApiResponse.json({ email: auth.user.email }, {
      headers: { 'Set-Cookie': cookie(next, ttl) },
    });
  }
  if (action === 'web-delete' && input.confirm !== 'DELETE')
    throw new AccountError(400, 'DELETE_CONFIRMATION_REQUIRED');
  const flow = action === 'web-session'
    ? await accountFlows.read(ticket) : await accountFlows.take(ticket);
  if (!flow) {
    if (action === 'web-logout') return json({ success: true }, true);
    throw new AccountError(401, 'AUTH_SESSION_REQUIRED');
  }
  const record = accountObject(flow);
  if (record.kind !== 'account-deletion') throw new AccountError(401, 'AUTH_SESSION_REQUIRED');
  const token = accountString(record.token, 16384);
  if (action === 'web-session') return json({ email: (await service.me(token)).email });
  try {
    if (action === 'web-delete') await service.remove(token, body);
    return json({ success: true }, true);
  } catch (error) {
    // A deletion attempt consumes its ticket even on failure. Re-authenticate before retrying.
    if (error instanceof AccountError)
      return ApiResponse.json({ code: error.code }, {
        status: error.status, headers: { 'Set-Cookie': cookie('', 0) },
      });
    throw error;
  } finally {
    await service.logout(token).catch(() => undefined);
  }
}
