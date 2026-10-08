import { createClient } from '@vocespace/client-sdk';
import { connect_endpoint } from '../std';

export function getWebClient() {
  return createClient({
    baseUrl: new URL(connect_endpoint('/'), window.location.origin).toString(),
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      try {
        const admin = JSON.parse(localStorage.getItem('vocespace_host_token_verified') || 'null');
        if (admin?.token && Date.now() - admin.at < 3600_000 && !headers.has('x-vocespace-host-token')) headers.set('x-vocespace-host-token', admin.token);
      } catch { /* An invalid cache is never an authentication source. */ }
      return fetch(input, { ...init, headers });
    },
  });
}
let bootstrap: Promise<Response> | undefined;
let sessionKnownUntil = 0;
export function ensureWebSession() {
  if (Date.now() < sessionKnownUntil) return Promise.resolve(new Response(null, { status: 204 }));
  if (!bootstrap) bootstrap = getWebClient().session.get().then((response) => {
    if (response.ok) sessionKnownUntil = Date.now() + 60_000;
    return response;
  }).finally(() => { bootstrap = undefined; });
  return bootstrap;
}
export async function apiFetch(input: string | URL, init?: RequestInit) {
  if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  await ensureWebSession();
  // Public setup/capability endpoints remain available when Redis is not configured.
  return getWebClient().transport(input, init);
}

let codeExchange: { code: string; response: Promise<Response> } | undefined;
/** StrictMode/re-renders must not consume a one-time code twice. */
export function exchangePlatformCode(code: string) {
  if (!codeExchange || codeExchange.code !== code) codeExchange = { code, response: getWebClient().session.exchange(code) };
  return codeExchange.response.then((response) => response.clone());
}

export async function logoutWebSession() {
  const response = await getWebClient().session.logout();
  if (!response.ok) throw new Error('Logout failed');
  sessionKnownUntil = 0;
  codeExchange = undefined;
}
