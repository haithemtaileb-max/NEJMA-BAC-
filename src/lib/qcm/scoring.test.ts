import { describe, expect, it } from 'vitest';

import { normalizeLabels, sameLabels, scoreQuestion, toScore20 } from './scoring';

describe('normalizeLabels', () => {
  it('upper-cases, de-duplicates, sorts and drops invalid labels', () => {
    expect(normalizeLabels(['c', 'A', 'a', 'Z', 'AB', ''])).toEqual(['A', 'C']);
    expect(normalizeLabels(null)).toEqual([]);
  });
});

describe('sameLabels', () => {
  it('ignores order and case', () => {
    expect(sameLabels(['B', 'a'], ['A', 'b'])).toBe(true);
    expect(sameLabels(['A'], ['A', 'B'])).toBe(false);
  });
});

describe('scoreQuestion', () => {
  const key = ['A', 'B', 'E'];

  it('gives 1 for an exact answer in both modes', () => {
    expect(scoreQuestion('multiple', key, ['E', 'A', 'B'], 'all_or_nothing')).toBe(1);
    expect(scoreQuestion('multiple', key, ['E', 'A', 'B'], 'partial')).toBe(1);
  });

  it('gives 0 for an incomplete answer in all-or-nothing mode', () => {
    expect(scoreQuestion('multiple', key, ['A', 'B'], 'all_or_nothing')).toBe(0);
  });

  it('gives proportional credit in partial mode', () => {
    expect(scoreQuestion('multiple', key, ['A', 'B'], 'partial')).toBe(0.6667);
    expect(scoreQuestion('multiple', key, ['A'], 'partial')).toBe(0.3333);
  });

  it('cancels the question when a wrong proposition is ticked', () => {
    expect(scoreQuestion('multiple', key, ['A', 'B', 'C'], 'partial')).toBe(0);
  });

  it('never gives partial credit on a QCS', () => {
    expect(scoreQuestion('single', ['C'], ['C'], 'partial')).toBe(1);
    expect(scoreQuestion('single', ['C'], ['C', 'D'], 'partial')).toBe(0);
  });

  it('gives 0 for a blank answer', () => {
    expect(scoreQuestion('multiple', key, [], 'partial')).toBe(0);
  });
});

describe('toScore20', () => {
  it('converts a raw score to a mark out of 20', () => {
    expect(toScore20(12, 16)).toBe(15);
    expect(toScore20(1, 3)).toBe(6.67);
    expect(toScore20(5, 0)).toBe(0);
  });
});
