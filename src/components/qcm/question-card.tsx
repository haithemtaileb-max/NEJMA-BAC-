'use client';

import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils/cn';
import type { OptionLabel, QcmOption, QcmType } from '@/types/domain';

/** Correction to overlay on the options once the answer is committed. */
export interface OptionCorrection {
  correct: readonly OptionLabel[];
  explanations?: Partial<Record<OptionLabel, string | null>>;
}

interface QuestionCardProps {
  stem: string;
  type: QcmType;
  options: QcmOption[];
  selected: readonly OptionLabel[];
  onToggle?: (label: OptionLabel) => void;
  correction?: OptionCorrection | null;
  /** Slot for bookmark / report / flag buttons. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * One QCM: stem + lettered propositions. Presentational only — selection and
 * correction state come from the parent (practice player, exam, results).
 */
export function QuestionCard({ stem, type, options, selected, onToggle, correction, actions, className }: QuestionCardProps) {
  const t = useTranslations('qcm');
  const locked = Boolean(correction) || !onToggle;

  return (
    <article className={cn('rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {type === 'single' ? t('single') : t('multiple')}
        </span>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>

      <h2 className="mt-4 whitespace-pre-line text-lg font-medium leading-relaxed">{stem}</h2>

      <div role={type === 'single' ? 'radiogroup' : 'group'} aria-label={stem} className="mt-5 space-y-2.5">
        {options.map((option) => {
          const isSelected = selected.includes(option.label);
          const isKey = correction?.correct.includes(option.label) ?? false;
          const explanation = correction?.explanations?.[option.label];

          // Visual state of a proposition before and after correction.
          const state = !correction
            ? isSelected
              ? 'selected'
              : 'idle'
            : isKey && isSelected
              ? 'hit'
              : isKey
                ? 'missed'
                : isSelected
                  ? 'wrong'
                  : 'neutral';

          return (
            <div key={option.label}>
              <button
                type="button"
                role={type === 'single' ? 'radio' : 'checkbox'}
                aria-checked={isSelected}
                aria-disabled={locked}
                onClick={() => !locked && onToggle?.(option.label)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[15px] leading-snug transition',
                  !locked && 'cursor-pointer hover:border-primary/50 hover:bg-muted/50',
                  locked && 'cursor-default',
                  state === 'idle' && 'border-border',
                  state === 'selected' && 'border-primary bg-primary-soft ring-1 ring-primary/30',
                  state === 'hit' && 'border-success bg-success-soft',
                  state === 'missed' && 'border-success border-dashed',
                  state === 'wrong' && 'border-danger bg-danger-soft',
                  state === 'neutral' && 'border-border opacity-70',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid h-7 w-7 shrink-0 place-items-center border text-xs font-semibold transition',
                    type === 'single' ? 'rounded-full' : 'rounded-lg',
                    state === 'idle' && 'border-border text-muted-foreground',
                    state === 'selected' && 'border-primary bg-primary text-primary-foreground',
                    state === 'hit' && 'border-success bg-success text-white',
                    state === 'missed' && 'border-success text-success',
                    state === 'wrong' && 'border-danger bg-danger text-white',
                    state === 'neutral' && 'border-border text-muted-foreground',
                  )}
                >
                  {state === 'hit' ? <Check className="h-4 w-4" /> : state === 'wrong' ? <X className="h-4 w-4" /> : option.label}
                </span>
                <span className="pt-0.5">{option.body}</span>
              </button>
              {explanation && (
                <p className={cn('ml-10 mt-1.5 text-sm', isKey ? 'text-success' : 'text-muted-foreground')}>{explanation}</p>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}
