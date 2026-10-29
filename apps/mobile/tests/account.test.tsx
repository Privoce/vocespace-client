vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '@vocespace/client-sdk';
const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  avatar: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  sendRegistrationCode: vi.fn(),
  verifyRegistration: vi.fn(),
  resetCode: vi.fn(),
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
import { AppState } from 'react-native';
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
  mocks.sendRegistrationCode.mockResolvedValue(undefined);
  mocks.verifyRegistration.mockResolvedValue(session);
  mocks.resetCode.mockResolvedValue(undefined);
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
it('sends registration mail without signing in and requires successful code verification', async () => {
  const hook = await setup();
  act(() => hook.result.current.open('register'));
  await act(async () => {
    await hook.result.current.sendRegistrationCode(user.email, 'password', false);
  });
  expect(hook.result.current.signedIn).toBe(false);
  expect(saved).toBeNull();
  mocks.verifyRegistration.mockRejectedValueOnce(new ApiError(400, 'AUTH_INVALID_CODE', 'invalid'));
  await act(async () => {
    await hook.result.current.authenticate(user.email, 'password', true, '123456');
  });
  expect(hook.result.current.signedIn).toBe(false);
  expect(hook.result.current.error).toBe('account_auth.invalid_code');
  await act(async () => {
    await hook.result.current.authenticate(user.email, 'password', true, '654321');
  });
  expect(hook.result.current.signedIn).toBe(true);
  expect(mocks.verifyRegistration).toHaveBeenLastCalledWith(user.email, '654321');
  expect(saved).not.toContain('654321');
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
it('does not restore an unchecked login after restarting the app', async () => {
  const hook = await setup();
  await act(async () => {
    await hook.result.current.authenticate(user.email, 'password', false);
  });
  expect(hook.result.current.signedIn).toBe(true);
  hook.unmount();
  const restarted = await setup();
  expect(restarted.result.current.signedIn).toBe(false);
  expect(saved).toBeNull();
});
it('opens code reset after sending mail and returns to login after password reset', async () => {
  const hook = await setup();
  await act(async () => {
    await hook.result.current.forgot(user.email);
  });
  expect(hook.result.current.screen).toBe('reset');
  mocks.resetCode.mockRejectedValueOnce(new ApiError(400, 'AUTH_INVALID_CODE', 'expired'));
  await act(async () => {
    await hook.result.current.resetPassword(user.email, '123456', 'new-password');
  });
  expect(hook.result.current.screen).toBe('reset');
  await act(async () => {
    await hook.result.current.resetPassword(user.email, '654321', 'new-password');
  });
  expect(hook.result.current.screen).toBe('login');
  expect(hook.result.current.message).toBe('account_auth.reset_done');
  expect(saved).toBeNull();
});

it('updates the visible and remembered avatar only after a successful upload', async () => {
  const hook = await setup();
  await act(async () => {
    await hook.result.current.authenticate(user.email, 'password', true);
  });
  mocks.avatar.mockRejectedValueOnce(new Error('upload failed'));
  const form = new FormData();
  await act(async () => {
    expect(await hook.result.current.uploadAvatar(form)).toBe(false);
  });
  expect(hook.result.current.profile.avatar).toBeUndefined();
  const avatar = 'https://images.test/profile.png';
  mocks.avatar.mockResolvedValueOnce({ ...user, avatar });
  await act(async () => {
    expect(await hook.result.current.uploadAvatar(form)).toBe(true);
  });
  expect(hook.result.current.profile.avatar).toBe(avatar);
  expect(JSON.parse(saved!).user.avatar).toBe(avatar);
  expect(mocks.avatar).toHaveBeenLastCalledWith('access', form);
});

it('saves nicknames remotely, persists the confirmed value and keeps the old name on failure', async () => {
  const hook = await setup();
  await act(async () => {
    await hook.result.current.authenticate(user.email, 'password', true);
  });
  mocks.profile.mockRejectedValueOnce(new ApiError(502, 'PROFILE_UPDATE_FAILED', 'failed'));
  await act(async () => {
    expect(await hook.result.current.updateNickname('新昵称')).toBe(false);
  });
  expect(hook.result.current.profile.nickname).toBe(user.nickname);
  expect(hook.result.current.error).toBe('account_auth.profile_failed');
  const updated = { ...user, nickname: '新昵称' };
  mocks.profile.mockResolvedValueOnce(updated);
  await act(async () => {
    expect(await hook.result.current.updateNickname('新昵称')).toBe(true);
  });
  expect(mocks.profile).toHaveBeenLastCalledWith('access', '新昵称');
  expect(hook.result.current.profile.nickname).toBe('新昵称');
  expect(JSON.parse(saved!).user.nickname).toBe('新昵称');
  hook.unmount();
  mocks.me.mockResolvedValue(updated);
  const restored = await setup();
  expect(restored.result.current.profile.nickname).toBe('新昵称');
});

it('waits for foreground account refresh when returning from the image picker', async () => {
  let foreground: (state: 'active') => void = () => {};
  const listener = vi.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
    foreground = callback;
    return { remove: () => {} };
  });
  try {
    const hook = await setup();
    await act(async () => {
      await hook.result.current.authenticate(user.email, 'password', true);
    });
    let resolveProfile!: (value: typeof user) => void;
    mocks.me.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProfile = resolve;
        }),
    );
    act(() => foreground('active'));
    mocks.avatar.mockResolvedValueOnce({ ...user, avatar: 'https://images.test/new.png' });
    let uploading!: Promise<boolean>;
    await act(async () => {
      uploading = hook.result.current.uploadAvatar(new FormData());
    });
    expect(mocks.avatar).not.toHaveBeenCalled();
    await act(async () => {
      resolveProfile(user);
      expect(await uploading).toBe(true);
    });
    expect(hook.result.current.profile.avatar).toBe('https://images.test/new.png');
    hook.unmount();
  } finally {
    listener.mockRestore();
  }
});
