import 'server-only';

import type { AppLocale } from '@/i18n/routing';
import { redirect } from '@/i18n/navigation';
import { isOnboarded, type OnboardedProfile, type Profile } from '@/types/domain';

import { getRepository } from './data';

export function getCurrentProfile(): Promise<Profile | null> {
  return getRepository().getCurrentProfile();
}

/**
 * Gate for every page of the app shell: signed in *and* major/year chosen.
 * (proxy.ts already bounces signed-out visitors; this also covers onboarding.)
 */
export async function requireOnboardedProfile(locale: AppLocale): Promise<OnboardedProfile> {
  const profile = await getCurrentProfile();
  if (!profile) return redirect({ href: '/login', locale });
  if (!isOnboarded(profile)) return redirect({ href: '/onboarding', locale });
  return profile;
}
