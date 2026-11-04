import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '../supabase/client';
import { platformConfiguration } from '../runtime-config';

type Auth = SupabaseClient['auth'];
export class PlatformAuthError extends Error {}
export function authErrorKey(error: unknown) {
  if (error instanceof PlatformAuthError) return `account.${error.message}`;
  const value = error as { code?: string; status?: number } | null;
  if (value?.status === 429) return 'account.rateLimited';
  const keys: Record<string, string> = {
    invalid_credentials: 'invalidCredentials',
    email_not_confirmed: 'confirmEmail',
    otp_expired: 'invalidCode',
    otp_disabled: 'invalidCode',
    weak_password: 'passwordShort',
    user_already_exists: 'emailExists',
    email_exists: 'emailExists',
    signup_disabled: 'registrationDisabled',
    same_password: 'samePassword',
    over_email_send_rate_limit: 'rateLimited',
    over_request_rate_limit: 'rateLimited',
  };
  return `account.${keys[value?.code || ''] || 'unavailable'}`;
}

/** Same signup/recovery OTP semantics as Mobile; the browser SDK owns its existing session. */
export function accountApi(auth: Auth, recoveryAuth: () => Auth) {
  return {
    async login(email: string, password: string) {
      const { data, error } = await auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user || !data.session) throw new PlatformAuthError('unavailable');
      return data.user.id;
    },
    async sendRegistration(email: string, password: string, resend: boolean) {
      if (resend) {
        const { error } = await auth.resend({ type: 'signup', email });
        if (error) throw error;
        return;
      }
      const { data, error } = await auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) {
        await auth.signOut({ scope: 'local' });
        throw new PlatformAuthError('confirmationRequired');
      }
      if (data.user?.identities?.length === 0) throw new PlatformAuthError('emailExists');
    },
    async verifyRegistration(email: string, code: string) {
      const { data, error } = await auth.verifyOtp({ email, token: code, type: 'signup' });
      if (error) throw error;
      if (!data.user || !data.session) throw new PlatformAuthError('invalidCode');
      return data.user.id;
    },
    async forgot(email: string) {
      const { error } = await recoveryAuth().resetPasswordForEmail(email);
      if (error) throw error;
    },
    async reset(email: string, code: string, password: string) {
      // Recovery must not install a temporary recovery session into the browser's normal account.
      const recovery = recoveryAuth();
      const { data, error } = await recovery.verifyOtp({ email, token: code, type: 'recovery' });
      if (error) throw error;
      try {
        if (!data.session || data.user?.email?.toLowerCase() !== email)
          throw new PlatformAuthError('invalidCode');
        const result = await recovery.updateUser({ password });
        if (result.error) throw result.error;
      } finally {
        await recovery.signOut({ scope: 'local' }).catch(() => undefined);
      }
    },
    async google(redirectTo: string) {
      const { data, error } = await auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      if (!data.url) throw new PlatformAuthError('unavailable');
      return data.url;
    },
  };
}
export type PlatformAccountApi = ReturnType<typeof accountApi>;
export function createAccountApi() {
  return accountApi(createClient().auth, () => {
    const { supabase } = platformConfiguration();
    return createSupabaseClient(supabase.url, supabase.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }).auth;
  });
}
