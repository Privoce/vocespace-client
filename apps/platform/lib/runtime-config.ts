export interface PlatformConfiguration {
  supabase: { url: string; publishableKey: string };
  meetingUrl: string;
}
export function platformConfiguration(): PlatformConfiguration {
  const value = typeof window !== 'undefined'
    ? (window as Window & { __VOCESPACE_PLATFORM__?: PlatformConfiguration }).__VOCESPACE_PLATFORM__
    : undefined;
  // SSR renders client components too; no network request uses this placeholder.
  return value || { supabase: { url: 'https://unconfigured.invalid', publishableKey: 'unconfigured' }, meetingUrl: '' };
}
