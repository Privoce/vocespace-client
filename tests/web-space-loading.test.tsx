import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DEFAULT_SPACE_INFO } from '../apps/web/lib/std/space';
const client = vi.hoisted(() => ({ getSpaceInfo: vi.fn() }));
vi.mock('../apps/web/lib/api/index', () => ({ api: client }));
vi.mock('../apps/web/lib/realtime/socket', () => ({ socket: {} }));
import { useSpaceInfo } from '../apps/web/lib/hooks/space';

it('never invents default rooms before the stored Space is loaded', async () => {
  const saved = DEFAULT_SPACE_INFO(123, false);
  client.getSpaceInfo.mockResolvedValue({ ok: true, json: async () => ({ settings: saved }) });
  const { result } = renderHook(() => useSpaceInfo('legacy-space', 'guest'));
  expect(result.current.settings.children).toEqual([]);
  await act(async () => { await result.current.fetchSettings(); });
  expect(result.current.settings.children).toEqual([]);
});

it('shows persisted public rooms after loading instead of removing them on connection', async () => {
  const saved = DEFAULT_SPACE_INFO(123, true);
  client.getSpaceInfo.mockResolvedValue({ ok: true, json: async () => ({ settings: saved }) });
  const { result } = renderHook(() => useSpaceInfo('new-space', 'guest'));
  await act(async () => { await result.current.fetchSettings(); });
  expect(result.current.settings.children).toEqual(saved.children);
});
