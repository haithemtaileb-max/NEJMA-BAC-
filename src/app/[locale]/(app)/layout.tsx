import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';

import { AppHeader } from '@/components/layout/app-header';
import { routing } from '@/i18n/routing';
import { requireOnboardedProfile } from '@/server/session';

/** Shell for every signed-in, onboarded page. */
export default async function AppLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await requireOnboardedProfile(locale);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </>
  );
}
