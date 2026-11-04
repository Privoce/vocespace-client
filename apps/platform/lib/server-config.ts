import 'server-only';
import { readConfiguration } from '@vocespace/config-node';
export function publicPlatformConfiguration() {
  const config = readConfiguration();
  return {
    supabase: { url: config.account.supabase.url, publishableKey: config.account.supabase.publishableKey },
    meetingUrl: `${config.deployment.publicOrigin}${config.deployment.basePath}`,
  };
}
