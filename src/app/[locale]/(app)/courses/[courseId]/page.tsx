import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { PracticeSession } from '@/components/qcm/practice-session';
import { Card } from '@/components/ui/card';
import { routing } from '@/i18n/routing';
import { localized } from '@/lib/utils/localized';
import { getRepository } from '@/server/data';

export async function generateMetadata({ params }: PageProps<'/[locale]/courses/[courseId]'>): Promise<Metadata> {
  const { locale, courseId } = await params;
  const found = await getRepository().getCourse(courseId);
  return { title: found ? localized(found.course.title, locale) : undefined };
}

/** Course-based QCM practice with instant feedback. */
export default async function CoursePracticePage({ params }: PageProps<'/[locale]/courses/[courseId]'>) {
  const { locale, courseId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const repo = getRepository();
  const found = await repo.getCourse(courseId);
  if (!found) notFound();

  const [questions, t] = await Promise.all([repo.listCourseQuestions(courseId), getTranslations()]);
  const bookmarks = await repo.listBookmarkedIds(questions.map((q) => q.id));

  return (
    <>
      <PageHeader
        back={{ href: `/modules/${found.module.id}`, label: localized(found.module.title, locale) }}
        title={localized(found.course.title, locale)}
        subtitle={t('common.questions', { count: questions.length })}
      />
      {questions.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">{t('qcm.empty')}</Card>
      ) : (
        <PracticeSession questions={questions} initialBookmarks={bookmarks} moduleId={found.module.id} />
      )}
    </>
  );
}
