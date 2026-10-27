import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AccountModel } from '../src/account/hooks/useAccount';
vi.mock('../src/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../src/ui/document-picker', () => ({ pickDocument: vi.fn() }));
import { useProfileScreen } from '../src/account/hooks/useProfileScreen';
afterEach(cleanup);

it('keeps the edit dialog and draft until the nickname is confirmed saved', async () => {
  const updateNickname = vi.fn().mockResolvedValueOnce(false);
  const account = {
    profile: { nickname: 'Before', username: 'room-name' },
    busy: false,
    updateNickname,
  } as unknown as AccountModel;
  const hook = renderHook(() => useProfileScreen(account));
  act(() => hook.result.current.edit());
  act(() => hook.result.current.setNickname(' New name '));
  await act(async () => {
    await hook.result.current.save();
  });
  expect(hook.result.current.panel).toBe('edit');
  expect(hook.result.current.nickname).toBe(' New name ');
  let finish!: (saved: boolean) => void;
  updateNickname.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  let saving!: Promise<void>;
  act(() => {
    saving = hook.result.current.save();
  });
  expect(hook.result.current.panel).toBe('edit');
  await act(async () => {
    finish(true);
    await saving;
  });
  expect(hook.result.current.panel).toBeUndefined();
  expect(updateNickname).toHaveBeenLastCalledWith('New name');
});
