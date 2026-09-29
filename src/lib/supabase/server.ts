import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { supabaseEnv } from './env';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Create one per request — never share it between requests.
 */
export async function createSupabaseServerClient() {
  if (!supabaseEnv) throw new Error('Supabase is not configured (demo mode).');
  const cookieStore = await cookies();

  return createServerClient(supabaseEnv.url, supabaseEnv.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
