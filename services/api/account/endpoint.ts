import { getConfig } from '../lib/server/config';
import { randomBytes, createHash } from 'node:crypto';
import { accountObject, accountString } from '@vocespace/contracts';
import { AccountError, createAccountService } from '@vocespace/server-core';
import { ApiRequest, ApiResponse } from '../http';
import { accountConfig, createSupabaseAccountProvider } from './supabase';
import { accountFlows } from './flow-store';
import { readAccountAvatar } from './avatar';
import { webAccountEndpoint } from './web';
const cookie = 'vocespace_password_recovery';
function baseUrl() {
  const raw = getConfig().account.publicUrl || `${getConfig().deployment.publicOrigin}${getConfig().deployment.basePath}`;
  if (!raw) throw new AccountError(503, 'AUTH_NOT_CONFIGURED');
  const url = new URL(raw);
  if (
    (url.protocol !== 'https:' &&
      !(
        process.env.NODE_ENV !== 'production' &&
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      )) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new AccountError(503, 'AUTH_NOT_CONFIGURED');
  url.pathname = url.pathname.replace(/\/$/, '') + '/';
  return url;
}
function recoveryCookie(value: string, maxAge: number, url: URL) {
  return `${cookie}=${value}; HttpOnly; SameSite=Strict; Path=${url.pathname}api/; Max-Age=${maxAge}${url.protocol === 'https:' ? '; Secure' : ''}`;
}
function bearer(request: ApiRequest) {
  const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token || token.length > 16384) throw new AccountError(401, 'AUTH_SESSION_REQUIRED');
  return token;
}
export async function accountEndpoint(request: ApiRequest, action: string) {
  try {
    const service = createAccountService(createSupabaseAccountProvider(accountConfig()));
    if (action === 'callback' && request.method === 'GET') {
      const base = baseUrl();
      const destination = new URL('account/reset-password', base);
      try {
        const state = accountString(request.nextUrl.searchParams.get('state'), 64);
        const flow = accountObject(await accountFlows.take(state));
        const auth = await service.exchange(
          accountString(request.nextUrl.searchParams.get('code')),
          accountString(flow.verifier),
        );
        if (flow.kind === 'signup') {
          await service.logout(auth.accessToken);
          destination.searchParams.set('confirmed', '1');
          return ApiResponse.redirect(destination, 303);
        }
        if (flow.kind !== 'recovery') throw new Error();
        destination.searchParams.set('method', 'link');
        const ticket = randomBytes(32).toString('hex');
        await accountFlows.write(ticket, { token: auth.accessToken }, 600);
        return ApiResponse.redirect(destination, {
          status: 303,
          headers: {
            'Set-Cookie': recoveryCookie(ticket, 600, base),
            'Referrer-Policy': 'no-referrer',
          },
        });
      } catch {
        destination.searchParams.set('invalid', '1');
        return ApiResponse.redirect(destination, {
          status: 303,
          headers: { 'Set-Cookie': recoveryCookie('', 0, base), 'Referrer-Policy': 'no-referrer' },
        });
      }
    }
    if (request.method !== 'POST') throw new AccountError(405, 'METHOD_NOT_ALLOWED');
    if (action === 'avatar') {
      if (request.headers.has('origin') || request.headers.has('sec-fetch-site'))
        throw new AccountError(403, 'NATIVE_TRANSPORT_REQUIRED');
      const token = bearer(request);
      const hash = createHash('sha256').update(token).digest('hex');
      if (!(await accountFlows.allow(`avatar:${hash}`, 10)))
        throw new AccountError(429, 'AUTH_RATE_LIMITED');
      const image = await readAccountAvatar(request);
      return ApiResponse.json(await service.avatar(token, image.bytes, image.type));
    }
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new AccountError(415, 'JSON_REQUIRED');
    const raw = await request.text();
    if (raw.length > 20_000) throw new AccountError(413, 'REQUEST_TOO_LARGE');
    const body: unknown = JSON.parse(raw);
    if (action.startsWith('web-'))
      return await webAccountEndpoint(request, action, body, service, baseUrl());
    if (action === 'reset-password') {
      const base = baseUrl();
      if (
        request.headers.get('origin') !== base.origin ||
        request.headers.get('x-vocespace-request') !== '1'
      )
        throw new AccountError(403, 'ORIGIN_DENIED');
      const password = accountString(accountObject(body).password, 256);
      if (password.length < 8) throw new AccountError(400, 'PASSWORD_TOO_SHORT');
      const flow = await accountFlows.take(request.cookies.get(cookie)?.value || '');
      if (!flow) throw new AccountError(401, 'RECOVERY_EXPIRED');
      await service.reset(accountString(accountObject(flow).token, 16384), body);
      return ApiResponse.json(
        { success: true },
        { headers: { 'Set-Cookie': recoveryCookie('', 0, base) } },
      );
    }
    // Token-returning endpoints are Native-only. Browsers never receive refresh tokens from them.
    const browser = request.headers.has('origin') || request.headers.has('sec-fetch-site');
    if (
      browser &&
      (action !== 'reset-code' ||
        request.headers.get('origin') !== baseUrl().origin ||
        request.headers.get('x-vocespace-request') !== '1')
    )
      throw new AccountError(403, 'NATIVE_TRANSPORT_REQUIRED');
    if (
      [
        'login',
        'register',
        'forgot-password',
        'refresh',
        'delete',
        'profile',
        'registration-code',
        'resend-registration',
        'verify-registration',
        'reset-code',
      ].includes(action)
    ) {
      if (!(await accountFlows.allow('global', 200)))
        throw new AccountError(429, 'AUTH_RATE_LIMITED');
      const input = accountObject(body);
      const identity =
        typeof input.email === 'string'
          ? input.email.trim().toLowerCase()
          : request.headers.get('authorization') || String(input.refreshToken || '');
      const hash = createHash('sha256').update(identity).digest('hex');
      if (!(await accountFlows.allow(`${action}:${hash}`, 10)))
        throw new AccountError(429, 'AUTH_RATE_LIMITED');
      if (
        ['register', 'registration-code', 'resend-registration', 'forgot-password'].includes(
          action,
        ) &&
        !(await accountFlows.allow(`send-code:${hash}`, 1))
      )
        throw new AccountError(429, 'AUTH_RATE_LIMITED');
    }
    switch (action) {
      case 'registration-code':
        await service.registrationCode(body);
        break;
      case 'resend-registration':
        await service.resendRegistration(body);
        break;
      case 'verify-registration':
        return ApiResponse.json(await service.verifyRegistration(body));
      case 'reset-code':
        await service.resetCode(body);
        break;
      case 'login':
        return ApiResponse.json(await service.login(body));
      case 'refresh':
        return ApiResponse.json(await service.refresh(body));
      case 'spaces':
        return ApiResponse.json(await service.spaces(bearer(request)));
      case 'profile':
        return ApiResponse.json(await service.profile(bearer(request), body));
      case 'me':
        return ApiResponse.json(await service.me(bearer(request)));
      case 'logout':
        await service.logout(bearer(request));
        break;
      case 'delete':
        await service.remove(bearer(request), body);
        break;
      case 'register':
      case 'forgot-password': {
        if (action === 'forgot-password' && accountObject(body).delivery === 'code') {
          await service.recover(body, '', '');
          break;
        }
        const state = randomBytes(32).toString('hex');
        const verifier = randomBytes(32).toString('base64url');
        const challenge = createHash('sha256').update(verifier).digest('base64url');
        const redirect = new URL('api/v1/account/callback', baseUrl());
        redirect.searchParams.set('state', state);
        await accountFlows.write(
          state,
          { verifier, kind: action === 'register' ? 'signup' : 'recovery' },
          3600,
        );
        try {
          if (action === 'register') {
            const result = await service.register(body, redirect.toString(), challenge);
            if (result.session) await accountFlows.take(state);
            return ApiResponse.json(result);
          }
          await service.recover(body, redirect.toString(), challenge);
        } catch (error) {
          await accountFlows.take(state);
          throw error;
        }
        break;
      }
      default:
        throw new AccountError(404, 'NOT_FOUND');
    }
    return ApiResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AccountError)
      return ApiResponse.json({ code: error.code }, { status: error.status });
    throw error;
  }
}
