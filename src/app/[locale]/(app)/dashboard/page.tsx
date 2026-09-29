import { ClipboardCheck, Target, Timer, Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getFormatter, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ModuleGrid } from '@/components/dashboard/module-grid';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentExams } from '@/components/dashboard/recent-exams';
import { StatCard } from '@/components/dashboard/stat-card';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { formatScore20 } from '@/lib/utils/format';
import { getRepository } from '@/server/data';
import { requireOnboardedProfile } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('nav'))('dashboard') };
}

export default async function DashboardPage({ params }: PageProps<'/[locale]/dashboard'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const profile = await requireOnboardedProfile(locale);
  const [t, format, data] = await Promise.all([getTranslations(), getFormatter(), getRepository().getDashboard(profile)]);
  const dash = '—';

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {profile.displayName ? t('dashboard.greeting', { name: profile.displayName }) : t('dashboard.greetingAnonymous')}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-primary-soft px-3 py-1 font-medium text-primary">
              {t('dashboard.track', { major: t(`majors.${profile.major}`), year: t(`years.${profile.studyYear}`) })}
            </span>
            <Link href="/onboarding" className="font-medium text-primary hover:underline">
              {t('dashboard.change')}
            </Link>
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ClipboardCheck} label={t('dashboard.stats.answered')} value={format.number(data.totals.answered)} />
        <StatCard icon={Target} label={t('dashboard.stats.accuracy')} value={data.totals.accuracyPct === null ? dash : format.number(data.totals.accuracyPct / 100, { style: 'percent', maximumFractionDigits: 1 })} />
        <StatCard icon={Timer} label={t('dashboard.stats.exams')} value={String(data.totals.examsTaken)} />
        <StatCard icon={Trophy} label={t('dashboard.stats.best')} value={data.totals.bestScore20 === null ? dash : `${formatScore20(data.totals.bestScore20, locale)}/20`} />
      </section>

      <QuickActions />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('dashboard.modulesTitle')}</h2>
          <ModuleGrid modules={data.modules} />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('dashboard.recentExams')}</h2>
          <RecentExams exams={data.recentExams} />
        </section>
      </div>
    </div>
  );
}
