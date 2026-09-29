import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { ExamResults } from '@/components/exam/exam-results';
import { ExamSimulator } from '@/components/exam/exam-simulator';
import { routing } from '@/i18n/routing';
import { getRepository } from '@/server/data';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('exam'))('setupTitle') };
}

/** A running exam (timer + autosave) or, once handed in, its correction. */
export default async function ExamSessionPage({ params }: PageProps<'/[locale]/exam/[sessionId]'>) {
  const { locale, sessionId } = await params;
  if (!hasLocale(routing.locales, locale) || !z.uuid().safeParse(sessionId).success) notFound();

  const repo = getRepository();
  const paper = await repo.getExamPaper(sessionId);
  if (!paper) notFound();

  if (paper.status !== 'in_progress') {
    const result = await repo.getExamResult(sessionId);
    if (!result) notFound();
    return <ExamResults result={result} />;
  }

  return <ExamSimulator paper={paper} />;
}
