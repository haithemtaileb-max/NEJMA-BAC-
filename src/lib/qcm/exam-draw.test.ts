import { describe, expect, it } from 'vitest';

import { defaultDurationMinutes } from './exam-config';
import { drawBalanced, shuffle } from './exam-draw';

/** Deterministic PRNG (mulberry32) so draws are reproducible. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pool = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `anat-${i}`, moduleId: 'anatomie' })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: `bioch-${i}`, moduleId: 'biochimie' })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: `physio-${i}`, moduleId: 'physiologie' })),
];

describe('drawBalanced', () => {
  it('spreads questions evenly across modules', () => {
    const paper = drawBalanced(pool, 9, seeded(1));
    const perModule = Object.groupBy(paper, (q) => q.moduleId);
    expect(perModule.anatomie).toHaveLength(3);
    expect(perModule.biochimie).toHaveLength(3);
    expect(perModule.physiologie).toHaveLength(3);
  });

  it('fills from larger modules once a small one is exhausted', () => {
    const paper = drawBalanced(pool, 13, seeded(2));
    const perModule = Object.groupBy(paper, (q) => q.moduleId);
    expect(perModule.biochimie).toHaveLength(3);
    expect(perModule.anatomie).toHaveLength(5);
    expect(perModule.physiologie).toHaveLength(5);
  });

  it('never repeats a question and caps at the pool size', () => {
    const paper = drawBalanced(pool, 100, seeded(3));
    expect(paper).toHaveLength(pool.length);
    expect(new Set(paper.map((q) => q.id)).size).toBe(pool.length);
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seeded(4));
    expect(out.toSorted()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('defaultDurationMinutes', () => {
  it('allows 1 min 30 per question, within bounds', () => {
    expect(defaultDurationMinutes(20)).toBe(30);
    expect(defaultDurationMinutes(1)).toBe(2);
    expect(defaultDurationMinutes(1000)).toBe(240);
  });
});
