'use client';

import { ArrowLeft, ArrowRight, Check, CircleAlert, Cloud, CloudOff, Flag, Loader2, Send, Timer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useReducer, useRef, useState, useTransition } from 'react';

import { QuestionCard } from '@/components/qcm/question-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useCountdown } from '@/hooks/use-countdown';
import { useQcmHotkeys } from '@/hooks/use-qcm-hotkeys';
import {
  answeredCount,
  createSessionState,
  flaggedCount,
  qcmSessionReducer,
  selectionAt,
  type QcmSessionAction,
} from '@/lib/qcm/session-reducer';
import { cn } from '@/lib/utils/cn';
import { formatClock } from '@/lib/utils/format';
import { saveExamAnswerAction, submitExamAction } from '@/server/actions/exam';
import type { DataErrorCode } from '@/server/data/repository';
import type { ExamPaper, ExamResult, OptionLabel } from '@/types/domain';

import { ExamResults } from './exam-results';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Timed exam in "official" conditions: no feedback until the paper is handed
 * in. Every change is autosaved server-side, so a refresh or a dead battery
 * does not lose answers; the paper is handed in automatically at 00:00.
 */
export function ExamSimulator({ paper }: { paper: ExamPaper }) {
  const t = useTranslations();
  const total = paper.questions.length;

  const [state, dispatch] = useReducer(qcmSessionReducer, null, () =>
    createSessionState(total, {
      selections: Object.fromEntries(paper.questions.map((q, i) => [i, q.selected])),
      flagged: Object.fromEntries(paper.questions.map((q, i) => [i, q.flagged])),
    }),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [result, setResult] = useState<ExamResult | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [error, setError] = useState<DataErrorCode | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const saveTimers = useRef(new Map<number, number>());
  const confirmRef = useRef<HTMLDialogElement>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const remaining = useCountdown(paper.expiresAt, paper.serverNow, () => submit(true));
  const question = paper.questions[state.index];
  const selected = selectionAt(state, state.index);

  /** Apply an action locally, then autosave that question (debounced per question). */
  function update(action: QcmSessionAction & { index: number }) {
    const next = qcmSessionReducer(state, action);
    dispatch(action);

    const timers = saveTimers.current;
    window.clearTimeout(timers.get(action.index));
    setSaveStatus('saving');
    timers.set(
      action.index,
      window.setTimeout(async () => {
        timers.delete(action.index);
        const q = paper.questions[action.index];
        const res = await saveExamAnswerAction(paper.sessionId, q.position, selectionAt(next, action.index), Boolean(next.flagged[action.index]));
        setSaveStatus(res.ok ? 'saved' : 'error');
      }, 500),
    );
  }

  function toggle(label: OptionLabel) {
    if (result || !question.options.some((o) => o.label === label)) return;
    update({ type: 'toggle', index: state.index, label, questionType: question.type });
  }

  function submit(automatic = false) {
    if (result || isSubmitting) return;
    confirmRef.current?.close();
    for (const id of saveTimers.current.values()) window.clearTimeout(id);
    saveTimers.current.clear();

    // Send every answer with the hand-in: it covers any autosave that failed.
    const latest = stateRef.current;
    const answers = Object.fromEntries(paper.questions.map((q, i) => [q.position, selectionAt(latest, i)]));
    startSubmit(async () => {
      const res = await submitExamAction(paper.sessionId, answers);
      if (res.ok) {
        setTimeUp(automatic);
        setResult(res.data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(res.error);
      }
    });
  }

  useQcmHotkeys(
    {
      onOption: toggle,
      onEnter: () => dispatch({ type: 'next' }),
      onNext: () => dispatch({ type: 'next' }),
      onPrev: () => dispatch({ type: 'prev' }),
    },
    !result,
  );

  if (result) return <ExamResults result={result} timeUp={timeUp} />;

  const answered = answeredCount(state);
  const flagged = flaggedCount(state);
  const danger = remaining <= 60;
  const warning = remaining <= 300;

  return (
    <div className="space-y-4">
      {/* Exam bar */}
      <Card className="sticky top-[4.5rem] z-20 flex flex-wrap items-center gap-x-5 gap-y-3 p-3 sm:px-5">
        <div
          role="timer"
          aria-label={t('exam.timeLeft')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-3 py-1.5 font-mono text-xl font-semibold tabular-nums',
            danger ? 'animate-pulse bg-danger-soft text-danger' : warning ? 'bg-warning-soft text-warning' : 'bg-muted',
          )}
        >
          <Timer className="h-5 w-5" aria-hidden="true" />
          {formatClock(remaining)}
        </div>
        <div className="min-w-40 flex-1 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('qcm.questionOf', { current: state.index + 1, total })}</span>
            <span className="tabular-nums">
              {answered}/{total}
            </span>
          </div>
          <ProgressBar value={(answered / total) * 100} label={t('exam.legendAnswered')} />
        </div>
        <SaveIndicator status={saveStatus} />
        <Button onClick={() => confirmRef.current?.showModal()} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          {t('exam.submit')}
        </Button>
      </Card>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          <CircleAlert className="h-4 w-4" aria-hidden="true" />
          {t(`errors.${error}`)}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <QuestionCard
            key={question.position}
            stem={question.stem}
            type={question.type}
            options={question.options}
            selected={selected}
            onToggle={toggle}
            actions={
              <button
                type="button"
                onClick={() => update({ type: 'toggleFlag', index: state.index })}
                aria-pressed={Boolean(state.flagged[state.index])}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition',
                  state.flagged[state.index] ? 'bg-warning-soft text-warning' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <Flag className={cn('h-3.5 w-3.5', state.flagged[state.index] && 'fill-current')} aria-hidden="true" />
                {state.flagged[state.index] ? t('exam.unflag') : t('exam.flag')}
              </button>
            }
          />
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => dispatch({ type: 'prev' })} disabled={state.index === 0}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t('qcm.previous')}
            </Button>
            <Button variant="secondary" onClick={() => dispatch({ type: 'next' })} disabled={state.index === total - 1}>
              {t('qcm.next')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Question navigator */}
        <Card className="h-fit p-4 lg:sticky lg:top-44">
          <h2 className="text-sm font-semibold">{t('exam.navigator')}</h2>
          <div className="mt-3 grid grid-cols-8 gap-1.5 lg:grid-cols-5">
            {paper.questions.map((q, i) => {
              const isAnswered = selectionAt(state, i).length > 0;
              return (
                <button
                  key={q.position}
                  type="button"
                  onClick={() => dispatch({ type: 'goto', index: i })}
                  aria-current={i === state.index ? 'step' : undefined}
                  aria-label={t('qcm.questionOf', { current: i + 1, total })}
                  className={cn(
                    'relative h-9 rounded-lg text-xs font-semibold tabular-nums transition',
                    isAnswered ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground hover:bg-border',
                    i === state.index && 'ring-2 ring-primary',
                  )}
                >
                  {i + 1}
                  {state.flagged[i] && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-card" />}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-primary-soft ring-1 ring-primary/30" /> {t('exam.legendAnswered')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-warning" /> {t('exam.legendFlagged')}
            </span>
          </div>
        </Card>
      </div>

      <dialog
        ref={confirmRef}
        aria-labelledby="confirm-submit"
        className="m-auto w-[min(100%-2rem,26rem)] rounded-2xl border border-border bg-card p-6 text-foreground shadow-xl"
      >
        <h2 id="confirm-submit" className="text-lg font-semibold">
          {t('exam.confirmTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('exam.confirmBody', { unanswered: total - answered, flagged })}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => confirmRef.current?.close()}>
            {t('exam.keepWorking')}
          </Button>
          <Button onClick={() => submit(false)}>
            <Check className="h-4 w-4" aria-hidden="true" />
            {t('exam.confirmSubmit')}
          </Button>
        </div>
      </dialog>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const t = useTranslations('exam');
  if (status === 'idle') return null;
  const Icon = status === 'saving' ? Loader2 : status === 'saved' ? Cloud : CloudOff;
  return (
    <span
      aria-live="polite"
      title={status === 'error' ? t('saveFailed') : undefined}
      className={cn('hidden items-center gap-1.5 text-xs sm:inline-flex', status === 'error' ? 'text-warning' : 'text-muted-foreground')}
    >
      <Icon className={cn('h-3.5 w-3.5', status === 'saving' && 'animate-spin')} aria-hidden="true" />
      {status === 'saving' ? t('saving') : status === 'saved' ? t('saved') : t('saveFailed')}
    </span>
  );
}
