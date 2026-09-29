import type { AnswerFeedback, OptionLabel, QcmType } from '@/types/domain';

/**
 * State machine shared by the practice player and the exam simulator.
 * Pure and framework-free so it can be unit-tested; the components plug it
 * into `useReducer`.
 */
export interface QcmSessionState {
  /** Index of the question on screen. */
  index: number;
  total: number;
  /** Selected labels per question index, always sorted. */
  selections: Record<number, OptionLabel[]>;
  flagged: Record<number, boolean>;
  /** Practice mode: correction received for a question — its answer is then locked. */
  feedback: Record<number, AnswerFeedback>;
}

export type QcmSessionAction =
  | { type: 'toggle'; index: number; label: OptionLabel; questionType: QcmType }
  | { type: 'goto'; index: number }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'toggleFlag'; index: number }
  | { type: 'feedback'; index: number; feedback: AnswerFeedback }
  | { type: 'reset' };

export function createSessionState(
  total: number,
  initial: Pick<Partial<QcmSessionState>, 'selections' | 'flagged'> = {},
): QcmSessionState {
  return {
    index: 0,
    total,
    selections: initial.selections ?? {},
    flagged: initial.flagged ?? {},
    feedback: {},
  };
}

const clampIndex = (index: number, total: number) => Math.min(Math.max(index, 0), Math.max(total - 1, 0));

export function qcmSessionReducer(state: QcmSessionState, action: QcmSessionAction): QcmSessionState {
  switch (action.type) {
    case 'toggle': {
      if (state.feedback[action.index]) return state; // answer already corrected
      const current = state.selections[action.index] ?? [];
      let next: OptionLabel[];
      if (action.questionType === 'single') {
        next = current.includes(action.label) ? [] : [action.label];
      } else {
        next = current.includes(action.label)
          ? current.filter((l) => l !== action.label)
          : [...current, action.label].sort();
      }
      return { ...state, selections: { ...state.selections, [action.index]: next } };
    }
    case 'goto':
      return { ...state, index: clampIndex(action.index, state.total) };
    case 'next':
      return { ...state, index: clampIndex(state.index + 1, state.total) };
    case 'prev':
      return { ...state, index: clampIndex(state.index - 1, state.total) };
    case 'toggleFlag':
      return { ...state, flagged: { ...state.flagged, [action.index]: !state.flagged[action.index] } };
    case 'feedback':
      return { ...state, feedback: { ...state.feedback, [action.index]: action.feedback } };
    case 'reset':
      return createSessionState(state.total);
  }
}

export function selectionAt(state: QcmSessionState, index: number): OptionLabel[] {
  return state.selections[index] ?? [];
}

export function answeredCount(state: QcmSessionState): number {
  return Object.values(state.selections).filter((labels) => labels.length > 0).length;
}

export function flaggedCount(state: QcmSessionState): number {
  return Object.values(state.flagged).filter(Boolean).length;
}
