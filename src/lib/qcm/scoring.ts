import type { OptionLabel, QcmType, ScoringMode } from '@/types/domain';

/** Sorted, de-duplicated, upper-cased labels; anything that is not A–H is dropped. */
export function normalizeLabels(labels: readonly string[] | null | undefined): OptionLabel[] {
  const valid = (labels ?? [])
    .map((l) => l.toUpperCase())
    .filter((l): l is OptionLabel => /^[A-H]$/.test(l));
  return [...new Set(valid)].sort();
}

export function sameLabels(a: readonly string[], b: readonly string[]): boolean {
  const x = normalizeLabels(a);
  const y = normalizeLabels(b);
  return x.length === y.length && x.every((label, i) => label === y[i]);
}

/**
 * Score one question in [0, 1].
 *
 * - `all_or_nothing`: 1 when the selection matches the key exactly, else 0.
 * - `partial`: QCS behaves like all_or_nothing. For QCM, ticking any wrong
 *   proposition cancels the question; otherwise the student earns
 *   (correct propositions ticked / correct propositions).
 *
 * KEEP IN SYNC with `private.qcm_score` in the Supabase migration — the DB
 * test suite checks both implementations against the same cases.
 */
export function scoreQuestion(
  type: QcmType,
  correct: readonly string[],
  selected: readonly string[],
  mode: ScoringMode,
): number {
  const key = normalizeLabels(correct);
  const answer = normalizeLabels(selected);

  if (answer.length === 0 || key.length === 0) return 0;
  if (sameLabels(key, answer)) return 1;
  if (mode === 'all_or_nothing' || type === 'single') return 0;
  if (!answer.every((label) => key.includes(label))) return 0;
  return Math.round((answer.length / key.length) * 10_000) / 10_000;
}

/** Convert a raw score (sum of question scores) into a mark out of 20, as UMMTO reports it. */
export function toScore20(rawScore: number, questionCount: number): number {
  if (questionCount <= 0) return 0;
  return Math.round(((rawScore * 20) / questionCount) * 100) / 100;
}
