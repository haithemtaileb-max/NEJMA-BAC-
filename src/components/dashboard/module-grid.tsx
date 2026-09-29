import { ChevronRight } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { MODULE_COLOR_CLASSES } from '@/components/ui/module-colors';
import { ModuleIcon } from '@/components/ui/module-icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { localized } from '@/lib/utils/localized';
import type { DashboardData } from '@/types/domain';

export async function ModuleGrid({ modules }: { modules: DashboardData['modules'] }) {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map((m) => {
        const colors = MODULE_COLOR_CLASSES[m.color] ?? MODULE_COLOR_CLASSES.slate;
        const accuracy = m.progress?.accuracyPct ?? null;
        return (
          <li key={m.id}>
            <Link
              href={`/modules/${m.id}`}
              className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', colors.soft)}>
                  <ModuleIcon name={m.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold leading-snug">{localized(m.title, locale)}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {m.questionCount > 0 ? t('common.questions', { count: m.questionCount }) : t('dashboard.noQuestions')}
                    {m.isIntegrated && <Badge tone="primary">{t('dashboard.integrated')}</Badge>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden="true" />
              </div>
              <div className="mt-auto space-y-1.5">
                <ProgressBar value={accuracy ?? 0} barClassName={colors.bar} label={localized(m.title, locale)} />
                <p className="text-xs text-muted-foreground">
                  {accuracy === null ? t('dashboard.notStarted') : t('dashboard.accuracy', { value: accuracy })}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
