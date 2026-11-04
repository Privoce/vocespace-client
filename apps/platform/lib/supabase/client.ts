import { createBrowserClient } from '@supabase/ssr';
import { platformConfiguration } from '../runtime-config';
export function createClient() {
  const { supabase } = platformConfiguration();
  return createBrowserClient(supabase.url || 'https://unconfigured.invalid', supabase.publishableKey || 'unconfigured');
}
