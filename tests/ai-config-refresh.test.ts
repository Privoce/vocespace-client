// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ ai: {
  enabled: true, apiKey: 'fake-old-key', apiUrl: 'https://old.invalid/v1', model: 'old-model', maxTokens: 4000,
} }));
vi.mock('../services/api/lib/server/config', () => ({ getConfig: () => structuredClone(state) }));
vi.mock('../services/api/lib/ai/load', () => ({ getDefaultPrompts: () => ({
  analysis: { system: 'test', user: 'test' }, summary: { system: 'test', user: 'test' },
  extraction: { easy: '', medium: '', max: '' },
}) }));
vi.mock('../services/api/lib/server/platform', () => ({ platformAPI: {}, convertPlatformToACARes: vi.fn() }));
vi.mock('../services/api/lib/std/blur', () => ({ blurBase64Image: vi.fn() }));
import { POST, GET } from '../services/api/handlers/ai';
import { ApiRequest } from '../services/api/http';
afterEach(() => vi.unstubAllGlobals());

it('reloads config for existing sessions, changes protocol/credentials, preserves history, and honors disable', async () => {
  const calls: { url: string; body: any; auth: string | null }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url: String(url), body, auth: new Headers(init.headers).get('authorization') });
    const content = JSON.stringify({ timestamp: calls.length, name: `Task ${calls.length}`, content: 'Work', same: 0 });
    return Response.json(String(url).endsWith('/responses') ? {
      id: 'test-response', status: 'completed', object: 'response',
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: content, annotations: [] }] }],
    } : { choices: [{ message: { content } }] });
  }));
  const post = () => POST(new ApiRequest('http://local.invalid/api/ai', { method: 'POST', body: JSON.stringify({
    spaceName: 'test-config', userId: 'test-user', freq: 1, lang: 'en', isAuth: false,
    screenShot: { data: 'data:image/jpeg;base64,fake', timestamp: calls.length + 1, showTime: false }, todos: [],
  }) }));
  expect((await post()).status).toBe(200);
  expect(calls[0].url).toBe('https://old.invalid/v1/chat/completions');
  state.ai = { enabled: true, apiKey: 'fake-new-key', apiUrl: 'https://new.invalid/api/v3/responses', model: 'new-model', maxTokens: 120000 };
  expect((await post()).status).toBe(200);
  expect(calls[1].url).toBe('https://new.invalid/api/v3/responses');
  expect(calls[1].auth).toBe('Bearer fake-new-key');
  expect(calls[1].body.model).toBe('new-model');
  expect(calls[1].body.max_output_tokens).toBe(120000);
  expect(calls[1].body.input[1].content).toContainEqual({ type: 'input_image', image_url: 'data:image/jpeg;base64,fake', detail: 'auto' });
  const result = await GET(new ApiRequest('http://local.invalid/api/ai?action=result&spaceName=test-config&userId=test-user'));
  expect((await result.json()).res.lines).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Task 1' })]));
  state.ai.apiKey = 'fake-rotated-key';
  await post();
  expect(calls[2].auth).toBe('Bearer fake-rotated-key');
  state.ai.enabled = false;
  expect((await post()).status).toBe(500);
  expect(calls).toHaveLength(3);
});
