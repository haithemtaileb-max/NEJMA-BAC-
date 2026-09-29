/**
 * Spaced repetition for flashcards, built on FSRS (the algorithm used by
 * modern Anki) via `ts-fsrs`.
 *
 * This module converts between the database row (`flashcard_progress`) and
 * ts-fsrs cards, so the rest of the app only deals with:
 *   - `previewIntervals(progress)` → what each button (Again/Hard/Good/Easy) would schedule
 *   - `review(progress, grade)`    → the new row to save + a review-log row
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';

export type SrsState = 'new' | 'learning' | 'review' | 'relearning';
export type SrsGrade = 'again' | 'hard' | 'good' | 'easy';

/** Mirror of a `flashcard_progress` row (camelCase). */
export interface SrsProgress {
  state: SrsState;
  due: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview: Date | null;
}

/** Mirror of a `flashcard_review_logs` row, minus ids. */
export interface SrsReviewLog {
  rating: 1 | 2 | 3 | 4;
  /** State *before* the review. */
  state: SrsState;
  due: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reviewedAt: Date;
}

const STATE_TO_DB: Record<State, SrsState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};
const STATE_FROM_DB: Record<SrsState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};
const GRADES: Record<SrsGrade, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const DAY_MS = 86_400_000;

/**
 * Exam-oriented defaults: 90 % target retention and intervals capped at one
 * academic year, since L1/L2 content is examined within the year.
 * Fuzz spreads reviews so cards learnt together do not all fall due together.
 */
export const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: 365,
    enable_fuzz: true,
    enable_short_term: true,
  }),
);

export function newProgress(now: Date = new Date()): SrsProgress {
  return fromCard(createEmptyCard(now));
}

function toCard(p: SrsProgress, now: Date): Card {
  return {
    due: p.due,
    stability: p.stability,
    difficulty: p.difficulty,
    // Deprecated in ts-fsrs, still part of its Card type: derive it instead of storing it.
    elapsed_days: p.lastReview ? Math.max(0, Math.floor((now.getTime() - p.lastReview.getTime()) / DAY_MS)) : 0,
    scheduled_days: p.scheduledDays,
    learning_steps: p.learningSteps,
    reps: p.reps,
    lapses: p.lapses,
    state: STATE_FROM_DB[p.state],
    last_review: p.lastReview ?? undefined,
  };
}

function fromCard(card: Card): SrsProgress {
  return {
    state: STATE_TO_DB[card.state],
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.last_review ?? null,
  };
}

/** Apply a grade. Save `progress` to flashcard_progress and append `log` to flashcard_review_logs. */
export function review(
  progress: SrsProgress,
  grade: SrsGrade,
  now: Date = new Date(),
): { progress: SrsProgress; log: SrsReviewLog } {
  const { card, log } = scheduler.next(toCard(progress, now), now, GRADES[grade]);
  return {
    progress: fromCard(card),
    log: {
      rating: log.rating as SrsReviewLog['rating'],
      state: STATE_TO_DB[log.state],
      due: log.due,
      stability: log.stability,
      difficulty: log.difficulty,
      scheduledDays: log.scheduled_days,
      learningSteps: log.learning_steps,
      reviewedAt: log.review,
    },
  };
}

/** Next due date for each button — shown under Again / Hard / Good / Easy. */
export function previewIntervals(progress: SrsProgress, now: Date = new Date()): Record<SrsGrade, Date> {
  const preview = scheduler.repeat(toCard(progress, now), now);
  return {
    again: preview[Rating.Again].card.due,
    hard: preview[Rating.Hard].card.due,
    good: preview[Rating.Good].card.due,
    easy: preview[Rating.Easy].card.due,
  };
}
