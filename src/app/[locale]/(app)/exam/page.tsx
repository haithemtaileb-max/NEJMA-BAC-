import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ExamSetupForm } from '@/components/exam/exam-setup-form';
import { PageHeader } from '@/components/layout/page-header';
import { routing } from '@/i18n/routing';
import { getRepository } from '@/server/data';
import { requireOnboardedProfile } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('exam'))('setupTitle') };
}

export default async function ExamSetupPage({ params, searchParams }: PageProps<'/[locale]/exam'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const profile = await requireOnboardedProfile(locale);
  const [modules, t, query] = await Promise.all([
    getRepository().listModules(profile.major, profile.studyYear),
    getTranslations(),
    searchParams,
  ]);
  const preselected = typeof query.module === 'string' && modules.some((m) => m.id === query.module) ? [query.module] : [];

  return (
    <>
      <PageHeader
        title={t('exam.setupTitle')}
        subtitle={
          <>
            {t(`majors.${profile.major}`)} · {t(`years.${profile.studyYear}`)} — {t('exam.setupSubtitle')}
          </>
        }
      />
      <ExamSetupForm modules={modules} preselected={preselected} />
    </>
  );
}
