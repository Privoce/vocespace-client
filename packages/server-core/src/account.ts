import {
  accountCredentials,
  accountObject,
  accountString,
  type AccountRegistration,
  type AccountSession,
  type AccountUser,
} from '@vocespace/contracts';
export class AccountError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
export interface AccountProvider {
  login(email: string, password: string): Promise<AccountSession>;
  register(
    email: string,
    password: string,
    redirect: string,
    challenge: string,
  ): Promise<AccountRegistration>;
  refresh(refreshToken: string): Promise<AccountSession>;
  user(token: string): Promise<AccountUser>;
  logout(token: string): Promise<void>;
  recover(email: string, redirect: string, challenge: string): Promise<void>;
  exchange(code: string, verifier: string): Promise<AccountSession>;
  password(token: string, password: string): Promise<void>;
  remove(user: AccountUser): Promise<void>;
}
/** Supabase authenticates identities; no caller-supplied UID is used for destructive actions. */
export function createAccountService(provider: AccountProvider) {
  return {
    login(value: unknown) {
      const input = accountCredentials(value);
      return provider.login(input.email, input.password);
    },
    register(value: unknown, redirect: string, challenge: string) {
      const input = accountCredentials(value);
      if (input.password.length < 8) throw new AccountError(400, 'PASSWORD_TOO_SHORT');
      return provider.register(input.email, input.password, redirect, challenge);
    },
    refresh(value: unknown) {
      return provider.refresh(accountString(accountObject(value).refreshToken));
    },
    me: (token: string) => provider.user(token),
    logout: (token: string) => provider.logout(token),
    recover(value: unknown, redirect: string, challenge: string) {
      const { email } = accountCredentials({ ...accountObject(value), password: 'unused' });
      return provider.recover(email, redirect, challenge);
    },
    exchange: (code: string, verifier: string) => provider.exchange(code, verifier),
    async reset(token: string, value: unknown) {
      const password = accountString(accountObject(value).password, 256);
      if (password.length < 8) throw new AccountError(400, 'PASSWORD_TOO_SHORT');
      await provider.user(token);
      await provider.password(token, password);
      await provider.logout(token).catch(() => undefined);
    },
    async remove(token: string, value: unknown) {
      const input = accountObject(value);
      if (input.confirm !== 'DELETE') throw new AccountError(400, 'DELETE_CONFIRMATION_REQUIRED');
      const user = await provider.user(token);
      const fresh = await provider.login(user.email, accountString(input.password, 256));
      try {
        if (fresh.user.id !== user.id) throw new AccountError(403, 'ACCOUNT_MISMATCH');
        await provider.remove(user);
      } finally {
        await provider.logout(fresh.accessToken).catch(() => undefined);
      }
    },
  };
}
