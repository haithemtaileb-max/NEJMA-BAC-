'use client';

import { CircleAlert, Play } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MODULE_COLOR_CLASSES } from '@/components/ui/module-colors';
import { ModuleIcon } from '@/components/ui/module-icon';
import { defaultDurationMinutes, MAX_DURATION_MINUTES, MIN_DURATION_MINUTES, QUESTION_COUNT_CHOICES } from '@/lib/qcm/exam-config';
import { cn } from '@/lib/utils/cn';
import { localized } from '@/lib/utils/localized';
import { startExamAction } from '@/server/actions/exam';
import type { DataErrorCode } from '@/server/data/repository';
import type { Module, ScoringMode } from '@/types/domain';

interface ExamSetupFormProps {
  modules: Array<Module & { questionCount: number }>;
  preselected: string[];
}

export function ExamSetupForm({ modules, preselected }: ExamSetupFormProps) {
  const t = useTranslations();
  const locale = useLocale();
  const withQuestions = modules.filter((m) => m.questionCount > 0);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(preselected.length ? preselected : withQuestions.map((m) => m.id)),
  );
  const available = withQuestions.filter((m) => selected.has(m.id)).reduce((sum, m) => sum + m.questionCount, 0);

  // Standard sizes that fit the pool, plus "everything available" when the pool is smaller than the largest size.
  const choices: number[] = QUESTION_COUNT_CHOICES.filter((n) => n <= available);
  if (available > 0 && available < Math.max(...QUESTION_COUNT_CHOICES) && !choices.includes(available)) choices.push(available);

  const [requestedCount, setRequestedCount] = useState<number>(20);
  const questionCount = choices.includes(requestedCount) ? requestedCount : (choices.at(-1) ?? 0);
  const [customDuration, setCustomDuration] = useState<number | null>(null);
  const duration = customDuration ?? defaultDurationMinutes(questionCount);
  const [scoringMode, setScoringMode] = useState<ScoringMode>('all_or_nothing');
  const [error, setError] = useState<DataErrorCode | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleModule(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startExamAction({
        locale,
        moduleIds: [...selected],
        questionCount,
        durationMinutes: duration,
        scoringMode,
      });
      if (!result.ok) setError(result.error);
    });
  }

  const allSelected = withQuestions.every((m) => selected.has(m.id));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{t('exam.modules')}</h2>
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => setSelected(allSelected ? new Set() : new Set(withQuestions.map((m) => m.id)))}
          >
            {allSelected ? t('exam.selectNone') : t('exam.selectAll')}
          </button>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {modules.map((m) => {
            const disabled = m.questionCount === 0;
            const checked = selected.has(m.id) && !disabled;
            const colors = MODULE_COLOR_CLASSES[m.color] ?? MODULE_COLOR_CLASSES.slate;
            return (
              <li key={m.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition',
                    checked ? 'border-primary bg-primary-soft/60' : 'border-border hover:bg-muted/50',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--primary)]"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleModule(m.id)}
                  />
                  <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', colors.soft)}>
                    <ModuleIcon name={m.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{localized(m.title, locale)}</span>
                    <span className="block text-xs text-muted-foreground">{t('common.questions', { count: m.questionCount })}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="h-fit space-y-6 p-5 lg:sticky lg:top-24">
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{t('exam.questionCount')}</h2>
            <span className="text-xs text-muted-foreground">{t('exam.available', { count: available })}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {choices.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={questionCount === n}
                onClick={() => {
                  setRequestedCount(n);
                  setCustomDuration(null);
                }}
                className={cn(
                  'h-10 min-w-12 rounded-xl border px-3 text-sm font-semibold tabular-nums transition',
                  questionCount === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="font-semibold">{t('exam.duration')}</span>
          <input
            type="number"
            min={MIN_DURATION_MINUTES}
            max={MAX_DURATION_MINUTES}
            value={duration}
            onChange={(e) => setCustomDuration(Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, Number(e.target.value) || MIN_DURATION_MINUTES)))}
            className="mt-2 block h-10 w-28 rounded-xl border border-border bg-background px-3 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <span className="mt-1 block text-xs text-muted-foreground">{t('exam.durationHint')}</span>
        </label>

        <fieldset>
          <legend className="font-semibold">{t('exam.scoring')}</legend>
          <div className="mt-2 space-y-2">
            {(['all_or_nothing', 'partial'] as const).map((mode) => (
              <label
                key={mode}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-xl border p-3 transition',
                  scoringMode === mode ? 'border-primary bg-primary-soft/60' : 'border-border hover:bg-muted/50',
                )}
              >
                <input
                  type="radio"
                  name="scoring"
                  className="mt-1 accent-[var(--primary)]"
                  checked={scoringMode === mode}
                  onChange={() => setScoringMode(mode)}
                />
                <span>
                  <span className="block text-sm font-medium">{t(`exam.scoringModes.${mode}`)}</span>
                  <span className="block text-xs text-muted-foreground">{t(`exam.scoringModes.${mode}Hint`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {(error || questionCount === 0) && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error ? t(`errors.${error}`) : t('exam.noModules')}
          </p>
        )}

        <Button size="lg" className="w-full" onClick={start} disabled={isPending || questionCount === 0}>
          <Play className="h-4 w-4" aria-hidden="true" />
          {t('exam.start')}
        </Button>
      </Card>
    </div>
  );
}
