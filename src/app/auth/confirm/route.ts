import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { routing } from '@/i18n/routing';
import { isDemoMode } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Landing URL of Supabase confirmation / magic-link emails. Exchanges the
 * code (PKCE) or token hash for a session cookie, then continues to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get('next') ?? '';
  const safeNext = /^\/(fr|en)\//.test(next) ? next : `/${routing.defaultLocale}/onboarding`;
  const locale = safeNext.slice(1, 3);
  if (isDemoMode) return NextResponse.redirect(new URL(safeNext, origin));

  const supabase = await createSupabaseServerClient();
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error('missing code') };

  return NextResponse.redirect(new URL(error ? `/${locale}/login` : safeNext, origin));
}
