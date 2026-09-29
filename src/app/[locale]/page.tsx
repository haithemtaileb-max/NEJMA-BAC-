import { Box, ClipboardCheck, Layers, Pill, Stethoscope, Timer } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { ToothIcon } from '@/components/ui/tooth-icon';
import { Link } from '@/i18n/navigation';
import { isDemoMode } from '@/lib/supabase/env';
import { MAJORS } from '@/types/domain';

const MAJOR_ICONS = { medicine: Stethoscope, dentistry: ToothIcon, pharmacy: Pill } as const;
const FEATURES = [
  { key: 'qcm', icon: ClipboardCheck },
  { key: 'exam', icon: Timer },
  { key: 'flashcards', icon: Layers },
  { key: 'anatomy', icon: Box },
] as const;

export default async function LandingPage() {
  const t = await getTranslations();

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <LocaleSwitcher />
      </header>

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 pb-20 pt-10 text-center sm:pt-16">
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          {t('common.faculty')} · {t('landing.badge')}
        </span>
        <h1 className="mt-6 max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">{t('landing.title')}</h1>
        <p className="mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">{t('landing.subtitle')}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={isDemoMode ? '/onboarding' : '/register'} className={buttonClasses('primary', 'lg')}>
            {isDemoMode ? t('demo.continue') : t('landing.cta')}
          </Link>
          {!isDemoMode && (
            <Link href="/login" className={buttonClasses('secondary', 'lg')}>
              {t('landing.login')}
            </Link>
          )}
        </div>

        <ul className="mt-10 flex flex-wrap justify-center gap-3">
          {MAJORS.map((major) => {
            const Icon = MAJOR_ICONS[major];
            return (
              <li key={major} className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-border">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {t(`majors.${major}`)}
              </li>
            );
          })}
        </ul>

        <section className="mt-16 grid w-full gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ key, icon: Icon }) => (
            <Card key={key} className="p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-semibold">{t(`landing.features.${key}.title`)}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{t(`landing.features.${key}.body`)}</p>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
