import { describe, expect, it } from 'vitest';

import { formatClock, formatScore20 } from './format';
import { localized } from './localized';

describe('formatClock', () => {
  it('formats minutes and hours', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(125)).toBe('02:05');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-4)).toBe('00:00');
  });
});

describe('formatScore20', () => {
  it('uses the locale decimal separator', () => {
    expect(formatScore20(13.5, 'fr')).toBe('13,5');
    expect(formatScore20(13.5, 'en')).toBe('13.5');
  });
});

describe('localized', () => {
  it('picks the UI language and falls back to French', () => {
    expect(localized({ fr: 'Cœur', en: 'Heart' }, 'en')).toBe('Heart');
    expect(localized({ fr: 'Cœur', en: '' }, 'en')).toBe('Cœur');
    expect(localized({ fr: 'Cœur', en: 'Heart' }, 'fr')).toBe('Cœur');
  });
});
