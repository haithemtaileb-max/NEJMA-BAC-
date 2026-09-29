'use client';

import { ArrowLeft, ArrowRight, CircleAlert, Clock, RotateCcw, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useReducer, useRef, useState, useTransition } from 'react';

import { Button, buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useQcmHotkeys } from '@/hooks/use-qcm-hotkeys';
import { useStopwatch } from '@/hooks/use-stopwatch';
import { Link } from '@/i18n/navigation';
import { createSessionState, qcmSessionReducer, selectionAt } from '@/lib/qcm/session-reducer';
import { cn } from '@/lib/utils/cn';
import { formatClock } from '@/lib/utils/format';
import { answerQcmAction } from '@/server/actions/qcm';
import type { DataErrorCode } from '@/server/data/repository';
import type { OptionLabel, Qcm } from '@/types/domain';

import { BookmarkButton } from './bookmark-button';
import { FeedbackPanel } from './feedback-panel';
import { QuestionCard } from './question-card';
import { ReportDialog } from './report-dialog';

interface PracticeSessionProps {
  questions: Qcm[];
  initialBookmarks: string[];
  moduleId: string;
}

/**
 * Course practice: answer → instant correction → next.
 * Answers are checked server-side (`answer_qcm`), so the answer key never
 * reaches the browser before the student commits.
 */
export function PracticeSession({ questions, initialBookmarks, moduleId }: PracticeSessionProps) {
  const t = useTranslations();
  const total = questions.length;
  const [state, dispatch] = useReducer(qcmSessionReducer, total, createSessionState);
  const [finished, setFinished] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [bookmarks, setBookmarks] = useState(() => new Set(initialBookmarks));
  const [error, setError] = useState<DataErrorCode | null>(null);
  const [isPending, startTransition] = useTransition();
  const shownAt = useRef(0);
  const elapsed = useStopwatch(!finished, attempt);

  const question = questions[state.index];
  const selected = selectionAt(state, state.index);
  const feedback = state.feedback[state.index];
  const answeredCount = Object.keys(state.feedback).length;
  const correctCount = Object.values(state.feedback).filter((f) => f.isCorrect).length;

  // Per-question timer, reported with the answer for analytics.
  useEffect(() => {
    shownAt.current = Date.now();
  }, [state.index, attempt]);

  function toggle(label: OptionLabel) {
    if (!question.options.some((o) => o.label === label)) return;
    setError(null);
    dispatch({ type: 'toggle', index: state.index, label, questionType: question.type });
  }

  function validate() {
    if (feedback || isPending || selected.length === 0) return;
    const index = state.index;
    const timeMs = Date.now() - shownAt.current;
    startTransition(async () => {
      const result = await answerQcmAction(question.id, selected, timeMs);
      if (result.ok) dispatch({ type: 'feedback', index, feedback: result.data });
      else setError(result.error);
    });
  }

  function advance() {
    if (!feedback) return validate();
    if (answeredCount === total) return setFinished(true);
    // Jump to the next unanswered question, wrapping around.
    for (let step = 1; step <= total; step++) {
      const next = (state.index + step) % total;
      if (!state.feedback[next]) return dispatch({ type: 'goto', index: next });
    }
  }

  function restart() {
    dispatch({ type: 'reset' });
    setFinished(false);
    setAttempt((a) => a + 1);
  }

  useQcmHotkeys(
    {
      onOption: toggle,
      onEnter: advance,
      onNext: () => dispatch({ type: 'next' }),
      onPrev: () => dispatch({ type: 'prev' }),
    },
    !finished,
  );

  if (finished) {
    const meanScore = Object.values(state.feedback).reduce((sum, f) => sum + f.score, 0) / total;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="mx-auto max-w-lg p-8 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Trophy className="h-8 w-8" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-semibold">{t('qcm.summaryTitle')}</h2>
          <p className="mt-2 text-4xl font-bold tabular-nums">{Math.round(meanScore * 100)} %</p>
          <p className="mt-1 text-muted-foreground">{t('qcm.summaryScore', { correct: correctCount, total })}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden="true" /> {formatClock(elapsed)}
          </p>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t('qcm.retry')}
            </Button>
            <Link href={`/modules/${moduleId}`} className={buttonClasses('secondary')}>
              {t('qcm.backToModule')}
            </Link>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{t('qcm.questionOf', { current: state.index + 1, total })}</span>
          <span className="inline-flex items-center gap-1.5 tabular-nums text-muted-foreground" title={t('qcm.elapsed')}>
            <Clock className="h-4 w-4" aria-hidden="true" />
            {formatClock(elapsed)}
          </span>
        </div>
        <ProgressBar value={(answeredCount / total) * 100} label={t('qcm.questionOf', { current: answeredCount, total })} />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {questions.map((q, i) => {
            const f = state.feedback[i];
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => dispatch({ type: 'goto', index: i })}
                aria-label={t('qcm.questionOf', { current: i + 1, total })}
                aria-current={i === state.index ? 'step' : undefined}
                className={cn(
                  'h-2.5 w-6 rounded-full transition',
                  !f && 'bg-border hover:bg-muted-foreground/40',
                  f?.isCorrect && 'bg-success',
                  f && !f.isCorrect && f.score > 0 && 'bg-warning',
                  f && f.score === 0 && 'bg-danger',
                  i === state.index && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                )}
              />
            );
          })}
        </div>
      </div>

      <motion.div key={`${attempt}-${state.index}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        <QuestionCard
          stem={question.stem}
          type={question.type}
          options={question.options}
          selected={selected}
          onToggle={toggle}
          correction={feedback ? { correct: feedback.correct, explanations: feedback.optionExplanations } : null}
          actions={
            <>
              <BookmarkButton
                qcmId={question.id}
                bookmarked={bookmarks.has(question.id)}
                onChange={(on) =>
                  setBookmarks((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(question.id);
                    else next.delete(question.id);
                    return next;
                  })
                }
              />
              <ReportDialog qcmId={question.id} />
            </>
          }
        />
      </motion.div>

      {feedback && <FeedbackPanel isCorrect={feedback.isCorrect} score={feedback.score} correct={feedback.correct} explanation={feedback.explanation} />}

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          <CircleAlert className="h-4 w-4" aria-hidden="true" />
          {t(`errors.${error}`)}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => dispatch({ type: 'prev' })} disabled={state.index === 0}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('qcm.previous')}</span>
        </Button>
        <Button size="lg" onClick={advance} disabled={isPending || (!feedback && selected.length === 0)}>
          {!feedback ? t('qcm.validate') : answeredCount === total ? t('qcm.finish') : t('qcm.next')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <p className="hidden text-center text-xs text-muted-foreground sm:block">{t('qcm.shortcuts')}</p>
    </div>
  );
}
