import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAuthForm } from '../src/account/hooks/useAuthForm';
import type { AccountModel } from '../src/account/hooks/useAccount';
function model() {
  return {
    screen: 'register',
    busy: false,
    sendRegistrationCode: vi.fn().mockResolvedValue(true),
    authenticate: vi.fn().mockResolvedValue(true),
    resetPassword: vi.fn().mockResolvedValue(true),
    forgot: vi.fn().mockResolvedValue(true),
    open: vi.fn(),
  } as unknown as AccountModel;
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('blocks duplicate sends, enables resend only after 60 seconds and binds the code to its email', async () => {
  vi.useFakeTimers();
  const account = model();
  const hook = renderHook(() => useAuthForm(account));
  act(() => {
    hook.result.current.setEmail('Person@Example.test');
    hook.result.current.setPassword('password');
    hook.result.current.setAccepted(true);
  });
  await act(async () => {
    await hook.result.current.sendCode();
  });
  expect(account.sendRegistrationCode).toHaveBeenCalledWith(
    'person@example.test',
    'password',
    false,
  );
  expect(hook.result.current.seconds).toBe(60);
  expect(hook.result.current.registrationSent).toBe(true);
  act(() => vi.advanceTimersByTime(59_000));
  await act(async () => {
    await hook.result.current.sendCode();
  });
  expect(account.sendRegistrationCode).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(1_000));
  expect(hook.result.current.seconds).toBe(0);
  await act(async () => {
    await hook.result.current.sendCode();
  });
  expect(account.sendRegistrationCode).toHaveBeenLastCalledWith(
    'person@example.test',
    'password',
    true,
  );
  act(() => {
    hook.result.current.setCode('123456');
    hook.result.current.setEmail('other@example.test');
  });
  expect(hook.result.current.code).toBe('');
  expect(hook.result.current.registrationSent).toBe(false);
  await act(async () => {
    await hook.result.current.submit();
  });
  expect(account.authenticate).not.toHaveBeenCalled();
  hook.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it('does not start a cooldown on failed mail delivery and validates before sending', async () => {
  const account = model();
  vi.mocked(account.sendRegistrationCode).mockResolvedValue(false);
  const hook = renderHook(() => useAuthForm(account));
  act(() => {
    hook.result.current.setEmail('invalid');
    hook.result.current.setPassword('password');
    hook.result.current.setAccepted(true);
  });
  await act(async () => {
    await hook.result.current.sendCode();
  });
  expect(account.sendRegistrationCode).not.toHaveBeenCalled();
  act(() => hook.result.current.setEmail('person@example.test'));
  await act(async () => {
    await hook.result.current.sendCode();
  });
  expect(hook.result.current.seconds).toBe(0);
  expect(hook.result.current.registrationSent).toBe(false);
});
it('verifies the registration code before sign-in and clears password/code on success', async () => {
  const account = model();
  const hook = renderHook(() => useAuthForm(account));
  act(() => {
    hook.result.current.setEmail('person@example.test');
    hook.result.current.setPassword('password');
    hook.result.current.setAccepted(true);
  });
  await act(async () => {
    await hook.result.current.sendCode();
  });
  act(() => hook.result.current.setCode('12345'));
  await act(async () => {
    await hook.result.current.submit();
  });
  expect(account.authenticate).not.toHaveBeenCalled();
  act(() => {
    hook.result.current.setCode('123456');
    hook.result.current.setRemember(false);
  });
  await act(async () => {
    await hook.result.current.submit();
  });
  expect(account.authenticate).toHaveBeenCalledWith(
    'person@example.test',
    'password',
    false,
    '123456',
  );
  expect(hook.result.current.password).toBe('');
  expect(hook.result.current.code).toBe('');
});

it('requires explicit consent for login, registration and registration email, but not recovery', async () => {
  const account = model();
  const hook = renderHook(() => useAuthForm(account));
  act(() => {
    hook.result.current.setEmail('person@example.test');
    hook.result.current.setPassword('password');
  });
  expect(hook.result.current.accepted).toBe(false);
  await act(async () => {
    await hook.result.current.sendCode();
    await hook.result.current.submit();
  });
  expect(account.sendRegistrationCode).not.toHaveBeenCalled();
  expect(account.authenticate).not.toHaveBeenCalled();
  expect(hook.result.current.invalid).toBe('legal.accept_required');
  account.screen = 'login';
  hook.rerender();
  await act(async () => {
    await hook.result.current.submit();
  });
  expect(account.authenticate).not.toHaveBeenCalled();
  act(() => hook.result.current.setAccepted(true));
  await act(async () => {
    await hook.result.current.submit();
  });
  expect(account.authenticate).toHaveBeenCalledOnce();
  act(() => hook.result.current.setAccepted(false));
  account.screen = 'forgot';
  hook.rerender();
  await act(async () => {
    await hook.result.current.sendCode();
  });
  expect(account.forgot).toHaveBeenCalledOnce();
});
