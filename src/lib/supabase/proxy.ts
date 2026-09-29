import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

import { supabaseEnv } from './env';

/**
 * Refreshes the Supabase session on every request and writes rotated auth
 * cookies onto `response` (the one produced by the i18n proxy).
 * Returns whether the visitor is signed in.
 */
export async function refreshSession(request: NextRequest, response: NextResponse): Promise<{ signedIn: boolean }> {
  if (!supabaseEnv) return { signedIn: true }; // demo mode: everyone is the demo student

  const supabase = createServerClient(supabaseEnv.url, supabaseEnv.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
        // No-cache headers so a CDN never serves one student's session to another.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Do not put code between client creation and getClaims(): it validates the
  // JWT (refreshing it if needed) and is what keeps sessions alive.
  const { data } = await supabase.auth.getClaims();
  return { signedIn: Boolean(data?.claims?.sub) };
}
