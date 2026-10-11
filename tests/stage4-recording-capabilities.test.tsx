import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { MessageInstance } from 'antd/es/message/interface';
vi.mock('../apps/web/lib/api/client', () => ({ apiFetch: (input: string, init: RequestInit) => fetch(input, init) }));
const fixtures = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock('../apps/web/lib/api/index', () => ({ api: { testS3Connection: fixtures.check } }));
vi.mock('../apps/web/lib/i18n/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
import { RecordState, useRecordingEnv } from '../apps/web/lib/std/recording';

const capabilities = { configured: true, s3_bucket: 'bucket', s3_region: 'region', server_host: 'https://example.test' };
const messages = () => ({ success: vi.fn(), error: vi.fn() } as unknown as MessageInstance);
beforeEach(() => {
  fixtures.check.mockReset().mockResolvedValue(Response.json({ success: true }));
});
afterEach(() => vi.unstubAllGlobals());

it('connects using capability metadata without requiring or storing storage credentials', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...capabilities, s3_access_key: 'old-key', s3_secret_key: 'old-secret' })));
  const { result, unmount } = renderHook(() => useRecordingEnv(messages()));
  await waitFor(() => expect(result.current.state).toBe(RecordState.Connected));
  expect(result.current.env).toEqual(capabilities);
  expect(fixtures.check).toHaveBeenCalledOnce();
  unmount();
});

it('reports a failed capability request instead of remaining stuck in initialization', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
  const { result, unmount } = renderHook(() => useRecordingEnv(messages()));
  await waitFor(() => expect(result.current.state).toBe(RecordState.UnAvailable));
  expect(fixtures.check).not.toHaveBeenCalled();
  unmount();
});

it('cancels and ignores a late capability response after unmount', async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn<typeof fetch>(() => new Promise((done) => { resolve = done; }));
  vi.stubGlobal('fetch', fetcher);
  const toast = messages();
  const { unmount } = renderHook(() => useRecordingEnv(toast));
  unmount();
  expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  await act(async () => { resolve(Response.json(capabilities)); });
  expect(fixtures.check).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
});
