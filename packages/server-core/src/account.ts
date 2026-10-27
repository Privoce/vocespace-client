import {
  ACCOUNT_AVATAR_MAX_BYTES,
  accountCredentials,
  accountCode,
  accountNickname,
  accountObject,
  accountString,
  type AccountRegistration,
  type AccountSession,
  type AccountUser,
  type AccountSpace,
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
  spaces(token: string, user: AccountUser): Promise<AccountSpace[]>;
  logout(token: string): Promise<void>;
  recover(email: string, redirect: string, challenge: string): Promise<void>;
  exchange(code: string, verifier: string): Promise<AccountSession>;
  password(token: string, password: string): Promise<void>;
  remove(user: AccountUser): Promise<void>;
  verify(email: string, code: string, type: 'signup' | 'recovery'): Promise<AccountSession>;
  resend(email: string): Promise<void>;
  avatar(token: string, user: AccountUser, bytes: Uint8Array, type: string): Promise<AccountUser>;
  profile(token: string, user: AccountUser, nickname: string): Promise<AccountUser>;
}
/** Supabase authenticates identities; no caller-supplied UID is used for destructive actions. */
export function createAccountService(provider: AccountProvider) {
  return {
    async profile(token: string, value: unknown) {
      const nickname = accountNickname(value);
      const user = await provider.user(token);
      return provider.profile(token, user, nickname);
    },
    async spaces(token: string) {
      const user = await provider.user(token);
      return provider.spaces(token, user);
    },
    async avatar(token: string, bytes: Uint8Array, type: string) {
      if (!bytes.length || bytes.length >= ACCOUNT_AVATAR_MAX_BYTES)
        throw new AccountError(400, 'AVATAR_TOO_LARGE');
      const prefix = Array.from(bytes.slice(0, 12));
      const ascii = (start: number, end: number) =>
        String.fromCharCode(...prefix.slice(start, end));
      const valid =
        (type === 'image/jpeg' && prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255) ||
        (type === 'image/png' && prefix.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10') ||
        (type === 'image/webp' && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') ||
        (type === 'image/gif' && ['GIF87a', 'GIF89a'].includes(ascii(0, 6)));
      if (!valid) throw new AccountError(400, 'AVATAR_INVALID_IMAGE');
      const user = await provider.user(token);
      return provider.avatar(token, user, bytes, type);
    },
    async registrationCode(value: unknown) {
      const input = accountCredentials(value);
      if (input.password.length < 8) throw new AccountError(400, 'PASSWORD_TOO_SHORT');
      const result = await provider.register(input.email, input.password, '', '');
      if (result.session) {
        await provider.logout(result.session.accessToken);
        throw new AccountError(409, 'EMAIL_CONFIRMATION_REQUIRED');
      }
    },
    resendRegistration(value: unknown) {
      const { email } = accountCredentials({ ...accountObject(value), password: 'unused' });
      return provider.resend(email);
    },
    verifyRegistration(value: unknown) {
      const { email, code } = accountCode(value);
      return provider.verify(email, code, 'signup');
    },
    async resetCode(value: unknown) {
      const { email, code } = accountCode(value);
      const password = accountString(accountObject(value).password, 256);
      if (password.length < 8) throw new AccountError(400, 'PASSWORD_TOO_SHORT');
      const auth = await provider.verify(email, code, 'recovery');
      try {
        if (auth.user.email.toLowerCase() !== email)
          throw new AccountError(403, 'ACCOUNT_MISMATCH');
        await provider.password(auth.accessToken, password);
      } finally {
        await provider.logout(auth.accessToken).catch(() => undefined);
      }
    },
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
