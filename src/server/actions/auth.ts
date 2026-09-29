'use server';

import { headers } from 'next/headers';
import { redirect as nextRedirect } from 'next/navigation';
import { z } from 'zod';

import { redirect } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { isDemoMode } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AuthFormState = {
  error?: 'invalid_input' | 'invalid_credentials' | 'email_taken' | 'weak_password' | 'email_not_confirmed' | 'generic';
  info?: 'check_email';
} | null;

const base = {
  locale: z.enum(routing.locales),
  email: z.email().max(254),
  password: z.string().min(8).max(72),
};
const signInSchema = z.object({ ...base, next: z.string().optional() });
const signUpSchema = z.object({ ...base, displayName: z.string().trim().min(2).max(80) });

/** Only follow `?next=` to a page of this site in the same locale (no open redirects). */
function safeNext(next: string | undefined, locale: AppLocale): string | null {
  return next && next.startsWith(`/${locale}/`) && !next.startsWith('//') ? next : null;
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'invalid_input' };
  const { locale, email, password, next } = parsed.data;

  if (!isDemoMode) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === 'invalid_credentials') return { error: 'invalid_credentials' };
      if (error.code === 'email_not_confirmed') return { error: 'email_not_confirmed' };
      return { error: 'generic' };
    }
  }

  const target = safeNext(next, locale);
  if (target) nextRedirect(target);
  return redirect({ href: '/dashboard', locale });
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'invalid_input' };
  const { locale, email, password, displayName } = parsed.data;

  if (!isDemoMode) {
    const supabase = await createSupabaseServerClient();
    const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Read by the `handle_new_user` trigger to fill the profile.
        data: { display_name: displayName, locale },
        emailRedirectTo: `${origin}/auth/confirm?next=/${locale}/onboarding`,
      },
    });
    if (error) {
      if (error.code === 'user_already_exists' || error.code === 'email_exists') return { error: 'email_taken' };
      if (error.code === 'weak_password') return { error: 'weak_password' };
      return { error: 'generic' };
    }
    // Email confirmation enabled: no session until the link is clicked.
    if (!data.session) return { info: 'check_email' };
  }

  return redirect({ href: '/onboarding', locale });
}

export async function signOut(locale: AppLocale): Promise<void> {
  if (!isDemoMode) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect({ href: '/', locale: routing.locales.includes(locale) ? locale : routing.defaultLocale });
}
