vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));
import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useMySpaces } from '../src/screens/meetings/hooks/useMySpaces';
import type { AccountModel } from '../src/account/hooks/useAccount';
it('deduplicates the primary room and hides previous-account or late rooms after switching accounts', async () => {
  let resolve!: (value: unknown[]) => void;
  const account = {
    profile: { id: 'a', username: 'alice' },
    listSpaces: vi
      .fn()
      .mockResolvedValue([
        { id: '1', name: 'Main', url: 'https://vocespace.com/alice', kind: 'meeting' },
      ]),
  } as unknown as AccountModel;
  const { result, rerender } = renderHook(({ value, active }) => useMySpaces(value, active), {
    initialProps: { value: account, active: true },
  });
  await waitFor(() => expect(result.current.rooms[0].name).toBe('Main'));
  expect(result.current.rooms).toHaveLength(1);
  const bob = {
    profile: { id: 'b', username: 'bob' },
    listSpaces: () =>
      new Promise<unknown[]>((r) => {
        resolve = r;
      }),
  } as unknown as AccountModel;
  rerender({ value: bob, active: true });
  expect(result.current.rooms.map((room) => room.name)).toEqual(['bob']);
  rerender({ value: { profile: { id: '', username: '' } } as AccountModel, active: false });
  await act(async () =>
    resolve([{ id: 'b', name: 'Private room', url: 'https://vocespace.com/bob', kind: 'meeting' }]),
  );
  expect(result.current.rooms).toEqual([]);
});
