import sharp from 'sharp';
import { getConfig } from './config';
import { ApiResponse } from '../../http';
import { accountObject, ContractError } from '@vocespace/contracts';

/** Called only after meeting/account authentication; never accepts an HTTP caller's owner id. */
export async function platformDataRequest(uid: string, action: string, method: string,
  query = new URLSearchParams(), input: unknown = {}, fetcher: typeof fetch = fetch): Promise<Response> {
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(uid))
    return ApiResponse.json({ code: 'PLATFORM_ID_REQUIRED' }, { status: 403 });
  const { url, serviceRoleKey } = getConfig().account.supabase;
  if (!url || !serviceRoleKey) return ApiResponse.json({ code: 'PLATFORM_NOT_CONFIGURED' }, { status: 503 });
  async function call(route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
    return fetcher(`${url.replace(/\/$/, '')}${route}`, { method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...headers },
      body: body === undefined ? undefined : body instanceof Uint8Array ? Buffer.from(body) : JSON.stringify(body) });
  }
  const result = (data: unknown, status = 200) => ApiResponse.json(data, { status });
  const failed = () => result({ code: 'PLATFORM_STORAGE_FAILED' }, 502);
  const numericDate = (value: unknown) => typeof value === 'string' && /^\d{1,16}$/.test(value);
  try {
    if ((action === 'user' || action === '') && method === 'GET') {
      const response = await call(`/rest/v1/user_info?id=eq.${uid}&select=username,avatar,online&limit=1`);
      if (!response.ok) return failed();
      const rows = await response.json();
      return result(action === 'user' ? { exist: !!rows[0] } : { data: rows[0] || null, online: !!rows[0]?.online });
    }
    if (!['todos', 'ai'].includes(action)) return result({ code: 'NOT_FOUND' }, 404);
    const table = action === 'todos' ? 'todos' : 'ai_analysis';
    const field = action === 'todos' ? 'items' : 'result';
    if (method === 'GET') {
      const date = query.get('date');
      if ((date !== null && !numericDate(date)) || (action === 'ai' && !date)) return result({ code: 'INVALID_DATE' }, 400);
      const response = await call(`/rest/v1/${table}?id=eq.${uid}${date ? `&date=eq.${date}` : ''}&select=*`);
      if (!response.ok) return failed();
      const rows = await response.json();
      return result(action === 'todos' ? { todos: rows } : { data: rows[0] || null });
    }
    if (!(method === 'POST' || method === 'DELETE' && action === 'todos')) return result({ code: 'METHOD_NOT_ALLOWED' }, 405);
    const body = accountObject(input);
    const data = action === 'todos' && method === 'POST' ? accountObject(body.todo) : body;
    const date = action === 'ai' ? String(Math.floor(Date.now() / 86400000) * 86400000)
      : method === 'DELETE' ? query.get('date') : data.date;
    if (!numericDate(date)) return result({ code: 'INVALID_DATE' }, 400);
    const incoming = method === 'DELETE' ? [] : action === 'todos' ? data.items : accountObject(accountObject(data.data).result).lines;
    if (!Array.isArray(incoming) || incoming.length > 1000) return result({ code: 'INVALID_ITEMS' }, 400);
    const key = action === 'todos' ? 'id' : 'timestamp';
    for (const item of incoming) {
      const value = accountObject(item)[key];
      if (action === 'todos' ? typeof value !== 'string' || value.length > 200 : typeof value !== 'number' || !Number.isFinite(value))
        return result({ code: 'INVALID_ITEM' }, 400);
    }
    if (method === 'DELETE' && !query.get('todoId')) return result({ code: 'INVALID_ITEM' }, 400);
    let screenshotImage: Buffer | undefined;
    if (action === 'ai') {
      const screenshot = accountObject(data.data).screenShot;
      if (screenshot !== undefined && screenshot !== '') {
        if (typeof screenshot !== 'string' || screenshot.length > 16 * 1024 * 1024 ||
            typeof data.timestamp !== 'number' || !Number.isFinite(data.timestamp))
          return result({ code: 'INVALID_IMAGE' }, 400);
        try {
          screenshotImage = await sharp(Buffer.from(screenshot.replace(/^data:image\/\w+;base64,/, ''), 'base64'), { limitInputPixels: 40_000_000 })
            .resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
        } catch { return result({ code: 'INVALID_IMAGE' }, 400); }
      }
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const route = `/rest/v1/${table}?id=eq.${uid}&date=eq.${date}`;
      const read = await call(`${route}&select=*`);
      if (!read.ok) return failed();
      const previous = (await read.json())[0];
      const old = previous?.[field] || [];
      const merged = new Map(old.map((item: Record<string, unknown>) => [item[key], item]));
      for (const item of incoming) merged.set(item[key], item);
      if (method === 'DELETE') merged.delete(query.get('todoId'));
      const next = { id: uid, date, [field]: [...merged.values()] };
      if (!previous && method === 'DELETE') return result({ success: true });
      // Compare-and-swap JSON prevents concurrent meeting updates overwriting each other.
      const write = previous
        ? await call(`${route}&${field}=eq.${encodeURIComponent(JSON.stringify(old))}`, 'PATCH', next)
        : await call(`/rest/v1/${table}`, 'POST', next);
      if (write.status === 409) continue;
      if (!write.ok) return failed();
      if (!(await write.json()).length) continue;
      if (screenshotImage) {
        const upload = await call(`/storage/v1/object/ai_analysis/public/${uid}_${data.timestamp}.jpg`, 'POST', screenshotImage,
          { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' });
        if (!upload.ok) return failed();
      }
      return result({ success: true });
    }
    return result({ code: 'PLATFORM_WRITE_CONFLICT' }, 409);
  } catch (error) { return error instanceof ContractError ? result({ code: 'INVALID_REQUEST' }, 400) : failed(); }
}
