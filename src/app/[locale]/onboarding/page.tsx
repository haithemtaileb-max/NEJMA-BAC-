import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { Logo } from '@/components/ui/logo';
import { redirect } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getCurrentProfile } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('onboarding'))('majorTitle') };
}

/** First screen after sign-up, and where "Change" on the dashboard leads. */
export default async function OnboardingPage({ params }: PageProps<'/[locale]/onboarding'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const profile = await getCurrentProfile();
  if (!profile) return redirect({ href: '/login', locale });

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 justify-center px-4 pb-16 pt-4 sm:pt-10">
        <OnboardingWizard initialMajor={profile.major} initialYear={profile.studyYear} />
      </main>
    </div>
  );
}
