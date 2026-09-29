/**
 * Exam simulator defaults. The pace mirrors UMMTO end-of-module exams (EMD),
 * where students get roughly 1 to 1.5 minutes per QCM.
 */
export const SECONDS_PER_QUESTION = 90;
export const QUESTION_COUNT_CHOICES = [10, 20, 40, 60] as const;
export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 240;

export function defaultDurationMinutes(questionCount: number): number {
  return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, Math.ceil((questionCount * SECONDS_PER_QUESTION) / 60)));
}

/** Autosubmit this long before the server stops accepting answers. */
export const SUBMIT_GRACE_SECONDS = 30;
