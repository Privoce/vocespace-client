import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '@vocespace/client-sdk';
const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  refresh: vi.fn(),
  me: vi.fn(),
  logout: vi.fn(),
  forgot: vi.fn(),
  remove: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  clear: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));
vi.mock('../src/account/client', () => ({
  configuredAccountClient: () => ({
    api: mocks,
    read: mocks.read,
    write: mocks.write,
    clear: mocks.clear,
  }),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: mocks }));
import { useAccount } from '../src/account/hooks/useAccount';
const user = {
  id: '11111111-2222-3333-4444-555555555555',
  email: 'person@example.test',
  nickname: 'Platform name',
};
const session = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: Date.now() + 3600000,
  user,
};
let saved: string | null;
beforeEach(() => {
  vi.resetAllMocks();
  saved = null;
  mocks.read.mockImplementation(async () => saved);
  mocks.write.mockImplementation(async (value) => {
    saved = value;
  });
  mocks.clear.mockImplementation(async () => {
    saved = null;
  });
  mocks.me.mockResolvedValue(user);
  mocks.login.mockResolvedValue(session);
  mocks.logout.mockResolvedValue(undefined);
  mocks.forgot.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
});
afterEach(cleanup);
async function setup() {
  const hook = renderHook(useAccount);
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}
it('uses the server identity and secure session storage, without persisting passwords', async () => {
  const hook = await setup();
  await act(async () => {
    await hook.result.current.authenticate(user.email, 'password-for-server', true);
  });
  expect(hook.result.current.profile.id).toBe(user.id);
  expect(hook.result.current.signedIn).toBe(true);
  expect(saved).toContain('refresh');
  expect(saved).not.toContain('password-for-server');
  expect(mocks.setItem).not.toHaveBeenCalled();
  hook.unmount();
  const restored = await setup();
  expect(restored.result.current.signedIn).toBe(true);
  await act(async () => {
    await restored.result.current.logout();
  });
  expect(saved).toBeNull();
  expect(restored.result.current.signedIn).toBe(false);
});
it('does not log in after confirmation-required registration and never falls back to demo credentials', async () => {
  mocks.register.mockResolvedValue({ session: null, confirmationRequired: true });
  const hook = await setup();
  act(() => hook.result.current.open('register'));
  await act(async () => {
    await hook.result.current.authenticate(user.email, 'password', true);
  });
  expect(hook.result.current.signedIn).toBe(false);
  expect(saved).toBeNull();
  expect(hook.result.current.message).toBe('account_auth.confirm_email');
  mocks.login.mockRejectedValue(new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'invalid'));
  await act(async () => {
    await hook.result.current.authenticate('syf@outlook.com', 'test001', true);
  });
  expect(hook.result.current.signedIn).toBe(false);
});
it('refreshes an expired stored session before verifying the account', async () => {
  saved = JSON.stringify({ ...session, expiresAt: 1 });
  mocks.refresh.mockResolvedValue({ ...session, refreshToken: 'rotated' });
  const hook = await setup();
  expect(mocks.refresh).toHaveBeenCalledWith('refresh');
  expect(saved).toContain('rotated');
  expect(hook.result.current.signedIn).toBe(true);
});
it('does not remember a session when unchecked and clears deletion state only on server success', async () => {
  const hook = await setup();
  await act(async () => {
    await hook.result.current.authenticate(user.email, 'password', false);
  });
  expect(saved).toBeNull();
  expect(hook.result.current.signedIn).toBe(true);
  mocks.remove.mockRejectedValueOnce(new ApiError(502, 'ACCOUNT_DELETION_FAILED', 'failed'));
  await act(async () => {
    expect(await hook.result.current.remove('password')).toBe(false);
  });
  expect(hook.result.current.signedIn).toBe(true);
  await act(async () => {
    expect(await hook.result.current.remove('password')).toBe(true);
  });
  expect(hook.result.current.signedIn).toBe(false);
  expect(mocks.removeItem).toHaveBeenCalledWith(`vocespace.account.preferences.${user.id}`);
});
it('keeps a recoverable stored session on network errors but rejects revoked sessions', async () => {
  saved = JSON.stringify(session);
  mocks.me.mockRejectedValueOnce(new Error('network'));
  const first = await setup();
  expect(first.result.current.signedIn).toBe(false);
  expect(saved).not.toBeNull();
  first.unmount();
  mocks.me.mockRejectedValueOnce(new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'revoked'));
  const second = await setup();
  expect(second.result.current.signedIn).toBe(false);
  expect(saved).toBeNull();
});

it('cleans up a successful remote login if saving credentials fails', async () => {
  mocks.write.mockRejectedValueOnce(new Error('keychain locked'));
  const hook = await setup();
  await act(async () => {
    expect(await hook.result.current.authenticate(user.email, 'password', true)).toBe(false);
  });
  expect(hook.result.current.signedIn).toBe(false);
  expect(mocks.logout).toHaveBeenCalledWith('access');
  expect(saved).toBeNull();
});
it('finishes restoring a revoked session even if local keychain deletion fails', async () => {
  saved = JSON.stringify(session);
  mocks.me.mockRejectedValueOnce(new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'revoked'));
  mocks.clear.mockRejectedValueOnce(new Error('keychain locked'));
  const hook = await setup();
  expect(hook.result.current.ready).toBe(true);
  expect(hook.result.current.signedIn).toBe(false);
});
