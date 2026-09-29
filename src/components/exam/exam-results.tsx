'use client';

import { CircleAlert, Clock, LayoutDashboard, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { QuestionCard } from '@/components/qcm/question-card';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { formatClock, formatScore20 } from '@/lib/utils/format';
import { localized } from '@/lib/utils/localized';
import type { ExamResult } from '@/types/domain';

/** Final score, per-module breakdown and full correction of an exam paper. */
export function ExamResults({ result, timeUp = false }: { result: ExamResult; timeUp?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const [filter, setFilter] = useState<'all' | 'mistakes'>('all');

  const counts = {
    correct: result.questions.filter((q) => q.isCorrect).length,
    partial: result.questions.filter((q) => !q.isCorrect && q.score > 0).length,
    wrong: result.questions.filter((q) => q.selected.length > 0 && q.score === 0).length,
    blank: result.questions.filter((q) => q.selected.length === 0).length,
  };
  const used = result.submittedAt
    ? Math.min(result.durationSeconds, Math.round((new Date(result.submittedAt).getTime() - new Date(result.startedAt).getTime()) / 1000))
    : result.durationSeconds;
  const moduleTitle = new Map(result.modules.map((m) => [m.moduleId, localized(m.title, locale)]));
  const shown = filter === 'all' ? result.questions : result.questions.filter((q) => !q.isCorrect);

  // Score ring geometry
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(1, result.score20 / 20);
  const tone = result.score20 >= 10 ? 'text-success' : result.score20 >= 7 ? 'text-warning' : 'text-danger';

  return (
    <div className="space-y-6">
      {(timeUp || result.status === 'expired') && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          {result.status === 'expired' ? t('exam.results.expired') : t('exam.timeUp')}
        </p>
      )}

      <Card className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center">
        <div className="relative mx-auto h-36 w-36">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r={radius} className="fill-none stroke-muted" strokeWidth="10" />
            <motion.circle
              cx="60"
              cy="60"
              r={radius}
              className={cn('fill-none stroke-current', tone)}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference * (1 - ratio) }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <span className={cn('text-3xl font-bold tabular-nums', tone)}>{formatScore20(result.score20, locale)}</span>
            <span className="text-xs text-muted-foreground">{t('exam.results.outOf20')}</span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('exam.results.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('common.questions', { count: result.questionCount })} · {t(`exam.scoringModes.${result.scoringMode}`)}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                ['correct', counts.correct, 'text-success'],
                ['partial', counts.partial, 'text-warning'],
                ['wrong', counts.wrong, 'text-danger'],
                ['blank', counts.blank, 'text-muted-foreground'],
              ] as const
            ).map(([key, value, color]) => (
              <div key={key} className="rounded-xl bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{t(`exam.results.${key}`)}</dt>
                <dd className={cn('text-xl font-semibold tabular-nums', color)}>{value}</dd>
              </div>
            ))}
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {t('exam.results.timeUsed')}
              </dt>
              <dd className="text-xl font-semibold tabular-nums">{formatClock(used)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('exam.results.byModule')}</h2>
        <Card className="divide-y divide-border">
          {result.modules.map((m) => {
            const pct = m.total ? (m.score / m.total) * 100 : 0;
            return (
              <div key={m.moduleId} className="grid gap-2 p-4 sm:grid-cols-[1fr_200px_80px] sm:items-center">
                <span className="font-medium">{localized(m.title, locale)}</span>
                <ProgressBar value={pct} label={localized(m.title, locale)} barClassName={pct >= 50 ? 'bg-success' : pct >= 35 ? 'bg-warning' : 'bg-danger'} />
                <span className="text-sm tabular-nums text-muted-foreground sm:text-right">
                  {m.correct}/{m.total} · {Math.round(pct)} %
                </span>
              </div>
            );
          })}
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('exam.results.review')}</h2>
          <div className="inline-flex rounded-xl border border-border bg-card p-0.5 text-sm">
            {(['all', 'mistakes'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn('rounded-lg px-3 py-1', filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
              >
                {f === 'all'
                  ? t('exam.results.filterAll', { count: result.questions.length })
                  : t('exam.results.filterMistakes', { count: result.questions.length - counts.correct })}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {shown.map((q) => (
            <div key={q.position} className="space-y-2">
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">#{q.position}</span>
                {moduleTitle.get(q.moduleId)}
                <span>·</span>
                <span>{q.selected.length ? t('exam.results.yourAnswer', { labels: q.selected.join(', ') }) : t('exam.results.noAnswer')}</span>
              </p>
              <QuestionCard
                stem={q.stem}
                type={q.type}
                options={q.options}
                selected={q.selected}
                correction={{
                  correct: q.options.filter((o) => o.isCorrect).map((o) => o.label),
                  explanations: Object.fromEntries(q.options.map((o) => [o.label, o.explanation])),
                }}
              />
              {q.explanation && (
                <p className="rounded-xl bg-muted/60 p-4 text-sm leading-relaxed">
                  <span className="font-medium">{t('qcm.explanation')}</span> {q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href="/exam" className={buttonClasses('primary', 'lg')}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t('exam.results.newExam')}
        </Link>
        <Link href="/dashboard" className={buttonClasses('secondary', 'lg')}>
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          {t('exam.results.dashboard')}
        </Link>
      </div>
    </div>
  );
}
