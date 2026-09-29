'use client';

import { CircleCheck, CircleX, Lightbulb, CircleDot } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils/cn';
import type { OptionLabel } from '@/types/domain';

interface FeedbackPanelProps {
  isCorrect: boolean;
  score: number;
  correct: readonly OptionLabel[];
  explanation: string | null;
}

/** Verdict + expected answer + explanation, shown right after validating. */
export function FeedbackPanel({ isCorrect, score, correct, explanation }: FeedbackPanelProps) {
  const t = useTranslations('qcm');
  const verdict = isCorrect ? 'correct' : score > 0 ? 'partial' : 'incorrect';
  const Icon = verdict === 'correct' ? CircleCheck : verdict === 'partial' ? CircleDot : CircleX;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      aria-live="polite"
      className={cn(
        'rounded-2xl border p-5',
        verdict === 'correct' && 'border-success/30 bg-success-soft',
        verdict === 'partial' && 'border-warning/30 bg-warning-soft',
        verdict === 'incorrect' && 'border-danger/30 bg-danger-soft',
      )}
    >
      <p
        className={cn(
          'flex items-center gap-2 font-semibold',
          verdict === 'correct' && 'text-success',
          verdict === 'partial' && 'text-warning',
          verdict === 'incorrect' && 'text-danger',
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
        {t(verdict)}
        {!isCorrect && <span className="font-normal text-foreground/80">— {t('expected', { labels: correct.join(', ') })}</span>}
      </p>
      {explanation && (
        <div className="mt-3 flex gap-2 text-sm leading-relaxed text-foreground/90">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <p>
            <span className="font-medium">{t('explanation')}</span>{' '}
            {explanation}
          </p>
        </div>
      )}
    </motion.section>
  );
}
