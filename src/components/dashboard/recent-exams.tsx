import { ChevronRight, Timer } from 'lucide-react';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { formatScore20 } from '@/lib/utils/format';
import type { ExamSessionSummary } from '@/types/domain';

export async function RecentExams({ exams }: { exams: ExamSessionSummary[] }) {
  const [t, format, locale] = await Promise.all([getTranslations(), getFormatter(), getLocale()]);

  return (
    <Card className="p-2">
      {exams.length === 0 ? (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Timer className="h-4 w-4" aria-hidden="true" />
          {t('dashboard.noExams')}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {exams.map((e) => (
            <li key={e.id}>
              <Link href={`/exam/${e.id}`} className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-muted">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t('common.questions', { count: e.questionCount })}</p>
                  <p className="text-xs text-muted-foreground">{format.dateTime(new Date(e.startedAt), { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                {e.status === 'in_progress' ? (
                  <Badge tone="warning">{t('dashboard.inProgress')}</Badge>
                ) : (
                  <span className="flex items-center gap-2">
                    {e.status === 'expired' && <Badge tone="danger">{t('dashboard.expired')}</Badge>}
                    <span className="text-sm font-semibold tabular-nums">{formatScore20(e.score20 ?? 0, locale)}/20</span>
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
