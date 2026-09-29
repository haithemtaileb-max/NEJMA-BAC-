/**
 * Supabase connection settings.
 *
 * When they are missing the app runs in **demo mode**: bundled sample content,
 * no accounts, nothing persisted beyond the server process. Handy to explore
 * the UI before creating a Supabase project — see docs/SETUP.md.
 */
export interface SupabaseEnv {
  url: string;
  /** Publishable key (`sb_publishable_…`) or legacy anon key. Safe to expose. */
  key: string;
}

function readEnv(): SupabaseEnv | null {
  // Literal `process.env.NEXT_PUBLIC_*` accesses so Next.js can inline them.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export const supabaseEnv = readEnv();

export const isDemoMode = supabaseEnv === null;
