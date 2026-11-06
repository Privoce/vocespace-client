import { createClient } from '@/lib/supabase/server';
import { readConfiguration } from '@vocespace/config-node';
import { NextRequest, NextResponse } from 'next/server';
// OAuth callbacks require request-time configuration and must never be prerendered.
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const origin = readConfiguration().deployment.platform.publicOrigin;
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const url = new URL(request.nextUrl.searchParams.get('type') === 'recovery'
        ? '/auth/forget-password' : `/auth/user/${data.user.id}`, origin);
      for (const key of ['spaceName', 'from']) {
        const value = request.nextUrl.searchParams.get(key);
        if (value) url.searchParams.set(key, value);
      }
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.redirect(new URL('/auth/auth-code-error', origin));
}
