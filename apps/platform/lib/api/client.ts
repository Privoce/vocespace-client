import { createClient } from '../supabase/client';
export async function platformFetch(action: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('x-vocespace-request', '1');
  if (action !== 'spaces') {
    const { data } = await createClient().auth.getSession();
    if (data.session) headers.set('authorization', `Bearer ${data.session.access_token}`);
  }
  return fetch(`/api/platform/${action}`, { ...init, headers, credentials: 'same-origin' });
}
