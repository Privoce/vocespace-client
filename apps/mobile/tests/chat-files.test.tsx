import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ pick: vi.fn(), open: vi.fn() }));
vi.mock('../src/ui/document-picker', () => ({ pickDocument: fake.pick }));
vi.mock('react-native', () => ({ Linking: { openURL: fake.open } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '12345678-1234-1234-1234-123456789abc' }));
import { useChatFiles } from '../src/chat/hooks/useChatFiles';
it('opens a member-scoped image preview in the App instead of the external browser', async () => {
  const transport = vi.fn().mockResolvedValue(new Response('{"url":"https://example.invalid/api/v1/native/files/capability"}'));
  const hook = renderHook(() => useChatFiles({ sdk: { transport } } as any, 'joined'));
  await act(async () => { await hook.result.current.download('stored.jpg', 'photo.jpg'); });
  expect(hook.result.current.preview?.name).toBe('photo.jpg');
  expect(hook.result.current.open).toBe(true);
  expect(JSON.parse(transport.mock.calls[0][1].body).name).toBe('stored.jpg');
  expect(fake.open).not.toHaveBeenCalled();
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('retains a failed attachment for retry with the same message ID', async () => {
  fake.pick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///test.pdf', name: 'test.pdf', size: 12, mimeType: 'application/pdf' }],
  });
  const transport = vi
    .fn()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce(new Response('{}'));
  const api = { sdk: { transport } } as any;
  const hook = renderHook(() => useChatFiles(api, 'joined'));
  await act(async () => {
    await hook.result.current.upload();
  });
  expect(hook.result.current.pending).toBe(true);
  expect(hook.result.current.error).toBe(true);
  const id = transport.mock.calls[0][1].body.get('id');
  await act(async () => {
    await hook.result.current.upload();
  });
  expect(fake.pick).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[1][1].body.get('id')).toBe(id);
  expect(hook.result.current.pending).toBe(false);
});
it('discards a delayed file list after moving rooms and cancels the old request', async () => {
  let finish!: (value: Response) => void;
  const transport = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(new Response('{"files":["new.pdf"]}'));
  const api = { sdk: { transport } } as any;
  const hook = renderHook(({ join }) => useChatFiles(api, join), { initialProps: { join: 'A' } });
  let first!: Promise<void>;
  act(() => {
    first = hook.result.current.list();
  });
  hook.rerender({ join: 'B' });
  expect(transport.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => {
    await hook.result.current.list();
    finish(new Response('{"files":["old.pdf"]}'));
    await first;
  });
  expect(hook.result.current.files).toEqual(['new.pdf']);
});
