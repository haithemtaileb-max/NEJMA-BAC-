import { ChevronRight, Timer } from 'lucide-react';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MODULE_COLOR_CLASSES } from '@/components/ui/module-colors';
import { ModuleIcon } from '@/components/ui/module-icon';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils/cn';
import { localized } from '@/lib/utils/localized';
import { getRepository } from '@/server/data';

export async function generateMetadata({ params }: PageProps<'/[locale]/modules/[moduleId]'>): Promise<Metadata> {
  const { locale, moduleId } = await params;
  const found = await getRepository().getModule(moduleId);
  return { title: found ? localized(found.title, locale) : undefined };
}

/** Module → units → courses, each course opening a practice set. */
export default async function ModulePage({ params }: PageProps<'/[locale]/modules/[moduleId]'>) {
  const { locale, moduleId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const repo = getRepository();
  const [mod, units, t] = await Promise.all([repo.getModule(moduleId), repo.listUnitsWithCourses(moduleId), getTranslations()]);
  if (!mod) notFound();

  const colors = MODULE_COLOR_CLASSES[mod.color] ?? MODULE_COLOR_CLASSES.slate;
  const questionTotal = units.flatMap((u) => u.courses).reduce((sum, c) => sum + c.questionCount, 0);

  return (
    <>
      <PageHeader
        back={{ href: '/dashboard', label: t('nav.dashboard') }}
        icon={
          <span className={cn('grid h-14 w-14 place-items-center rounded-2xl', colors.soft)}>
            <ModuleIcon name={mod.icon} className="h-7 w-7" />
          </span>
        }
        title={localized(mod.title, locale)}
        subtitle={`${t(`majors.${mod.major}`)} · ${t(`years.${mod.studyYear}`)} · ${t('common.questions', { count: questionTotal })}`}
        actions={
          questionTotal > 0 && (
            <Link href={`/exam?module=${mod.id}`} className={buttonClasses('secondary')}>
              <Timer className="h-4 w-4" aria-hidden="true" />
              {t('module.startExam')}
            </Link>
          )
        }
      />

      {units.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">{t('module.noCourses')}</Card>
      ) : (
        <div className="space-y-6">
          {units.map((unit) => (
            <section key={unit.id}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{localized(unit.title, locale)}</h2>
              <Card className="divide-y divide-border">
                {unit.courses.map((course) => (
                  <div key={course.id} className="flex items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium">{localized(course.title, locale)}</h3>
                      <p className="text-xs text-muted-foreground">{t('common.questions', { count: course.questionCount })}</p>
                    </div>
                    {course.questionCount > 0 && (
                      <Link href={`/courses/${course.id}`} className={buttonClasses('primary', 'sm')}>
                        {t('module.practice')}
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
