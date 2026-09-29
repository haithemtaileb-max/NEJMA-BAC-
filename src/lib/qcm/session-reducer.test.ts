import { describe, expect, it } from 'vitest';

import type { AnswerFeedback } from '@/types/domain';

import { answeredCount, createSessionState, flaggedCount, qcmSessionReducer as reduce, selectionAt } from './session-reducer';

const feedback: AnswerFeedback = { isCorrect: true, score: 1, correct: ['A'], explanation: null, optionExplanations: {} };

describe('qcmSessionReducer', () => {
  it('toggles several options on a QCM and keeps them sorted', () => {
    let s = createSessionState(3);
    s = reduce(s, { type: 'toggle', index: 0, label: 'C', questionType: 'multiple' });
    s = reduce(s, { type: 'toggle', index: 0, label: 'A', questionType: 'multiple' });
    expect(selectionAt(s, 0)).toEqual(['A', 'C']);
    s = reduce(s, { type: 'toggle', index: 0, label: 'C', questionType: 'multiple' });
    expect(selectionAt(s, 0)).toEqual(['A']);
  });

  it('keeps a single option on a QCS', () => {
    let s = createSessionState(1);
    s = reduce(s, { type: 'toggle', index: 0, label: 'A', questionType: 'single' });
    s = reduce(s, { type: 'toggle', index: 0, label: 'D', questionType: 'single' });
    expect(selectionAt(s, 0)).toEqual(['D']);
  });

  it('locks the answer once corrected', () => {
    let s = createSessionState(1);
    s = reduce(s, { type: 'toggle', index: 0, label: 'A', questionType: 'single' });
    s = reduce(s, { type: 'feedback', index: 0, feedback });
    expect(reduce(s, { type: 'toggle', index: 0, label: 'B', questionType: 'single' })).toBe(s);
  });

  it('clamps navigation to the paper', () => {
    let s = createSessionState(2);
    s = reduce(s, { type: 'prev' });
    expect(s.index).toBe(0);
    s = reduce(reduce(reduce(s, { type: 'next' }), { type: 'next' }), { type: 'next' });
    expect(s.index).toBe(1);
    expect(reduce(s, { type: 'goto', index: 99 }).index).toBe(1);
  });

  it('counts answered and flagged questions, and restores initial state', () => {
    let s = createSessionState(3, { selections: { 0: ['A'], 1: [] }, flagged: { 2: true } });
    expect(answeredCount(s)).toBe(1);
    expect(flaggedCount(s)).toBe(1);
    s = reduce(s, { type: 'toggleFlag', index: 2 });
    expect(flaggedCount(s)).toBe(0);
    expect(reduce(s, { type: 'reset' })).toEqual(createSessionState(3));
  });
});
