import { describe, expect, it } from 'vitest';

import { newProgress, previewIntervals, review } from './scheduler';

const DAY = 86_400_000;
const start = new Date('2026-10-01T08:00:00Z');

describe('FSRS scheduler', () => {
  it('starts a card as new and due now', () => {
    const p = newProgress(start);
    expect(p).toMatchObject({ state: 'new', reps: 0, lapses: 0, lastReview: null });
    expect(p.due.getTime()).toBe(start.getTime());
  });

  it('orders the four buttons from soonest to latest', () => {
    const preview = previewIntervals(newProgress(start), start);
    expect(preview.again.getTime()).toBeLessThanOrEqual(preview.hard.getTime());
    expect(preview.hard.getTime()).toBeLessThanOrEqual(preview.good.getTime());
    expect(preview.good.getTime()).toBeLessThan(preview.easy.getTime());
  });

  it('grows intervals with successful reviews and logs the previous state', () => {
    let p = newProgress(start);
    let now = start;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      const { progress, log } = review(p, 'good', now);
      if (i === 0) expect(log).toMatchObject({ rating: 3, state: 'new' });
      intervals.push(progress.due.getTime() - now.getTime());
      now = progress.due;
      p = progress;
    }
    expect(p.state).toBe('review');
    expect(intervals.at(-1)!).toBeGreaterThan(intervals[1]);
  });

  it('counts a lapse when a review card is forgotten', () => {
    let p = newProgress(start);
    let now = start;
    for (let i = 0; i < 3; i++) {
      p = review(p, 'good', now).progress;
      now = p.due;
    }
    const lapsed = review(p, 'again', now).progress;
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.state).toBe('relearning');
    expect(lapsed.due.getTime() - now.getTime()).toBeLessThan(DAY);
  });

  it('caps intervals at one academic year', () => {
    let p = newProgress(start);
    let now = start;
    for (let i = 0; i < 20; i++) {
      p = review(p, 'easy', now).progress;
      now = p.due;
    }
    expect(p.scheduledDays).toBeLessThanOrEqual(365);
  });
});
