import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));
vi.mock('../src/account/config', () => ({
  demoCredentials: { email: 'demo@example.test', password: 'demo-only-password' },
}));
import { useDemoAccount } from '../src/account/useDemoAccount';
import { accountProfileKey, accountSessionKey, parseDemoProfile } from '../src/account/model';

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  storage.getItem.mockImplementation(async (key: string) => values.get(key) ?? null);
  storage.setItem.mockImplementation(async (key: string, value: string) => {
    values.set(key, value);
  });
  storage.removeItem.mockImplementation(async (key: string) => {
    values.delete(key);
  });
});
afterEach(cleanup);
async function setup() {
  const hook = renderHook(useDemoAccount);
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}
it('rejects invalid credentials without saving a session, and lets guests browse', async () => {
  const { result } = await setup();
  await act(async () => {
    expect(await result.current.authenticate('demo@example.test', 'wrong', true)).toBe(false);
  });
  expect(result.current.error).toBe('native_account.credentials_error');
  expect(values.size).toBe(0);
  act(() => result.current.browse());
  expect(result.current.screen).toBeNull();
  expect(result.current.signedIn).toBe(false);
});
it('remembers only the account marker, restores a session, and removes it on logout', async () => {
  const first = await setup();
  await act(async () => {
    expect(
      await first.result.current.authenticate(' DEMO@example.test ', 'demo-only-password', true),
    ).toBe(true);
  });
  expect(values.get(accountSessionKey)).toBe('demo@example.test');
  expect(JSON.stringify([...values])).not.toContain('demo-only-password');
  first.unmount();
  const second = await setup();
  expect(second.result.current.signedIn).toBe(true);
  expect(second.result.current.screen).toBeNull();
  await act(async () => {
    expect(await second.result.current.logout()).toBe(true);
  });
  expect(values.has(accountSessionKey)).toBe(false);
  expect(second.result.current.signedIn).toBe(false);
});
it('does not restore login when remember me is disabled', async () => {
  const first = await setup();
  await act(async () => {
    await first.result.current.authenticate('demo@example.test', 'demo-only-password', false);
  });
  expect(first.result.current.signedIn).toBe(true);
  first.unmount();
  const second = await setup();
  expect(second.result.current.signedIn).toBe(false);
  expect(second.result.current.screen).toBe('login');
});
it('does not claim login or logout succeeded when persistence fails', async () => {
  const { result } = await setup();
  storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'));
  await act(async () => {
    expect(await result.current.authenticate('demo@example.test', 'demo-only-password', true)).toBe(
      false,
    );
  });
  expect(result.current.signedIn).toBe(false);
  await act(async () => {
    await result.current.authenticate('demo@example.test', 'demo-only-password', true);
  });
  storage.removeItem.mockRejectedValueOnce(new Error('storage unavailable'));
  await act(async () => {
    expect(await result.current.logout()).toBe(false);
  });
  expect(result.current.signedIn).toBe(true);
  expect(result.current.error).toBe('native_account.storage_error');
});
it('persists edited profile and local preferences across mounts', async () => {
  const first = await setup();
  act(() =>
    first.result.current.update({ nickname: ' Ada ', notifications: false, gestures: false }),
  );
  await waitFor(() => expect(values.has(accountProfileKey)).toBe(true));
  first.unmount();
  const second = await setup();
  expect(second.result.current.profile).toEqual({
    email: 'demo@example.test',
    nickname: 'Ada',
    notifications: false,
    gestures: false,
  });
});
it('ignores malformed profiles and profiles belonging to another configured account', () => {
  expect(parseDemoProfile('{', 'demo@example.test').nickname).toBe('夜风_Nightfall');
  expect(
    parseDemoProfile(
      JSON.stringify({ email: 'other@example.test', nickname: 'Other' }),
      'demo@example.test',
    ).nickname,
  ).toBe('夜风_Nightfall');
  const parsed = parseDemoProfile(
    JSON.stringify({
      email: 'demo@example.test',
      nickname: ' Ada ',
      notifications: 'false',
      role: 'owner',
    }),
    'demo@example.test',
  );
  expect(parsed.nickname).toBe('Ada');
  expect(parsed.notifications).toBe(true);
  expect(parsed).not.toHaveProperty('role');
});
