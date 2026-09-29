import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import { buildSeedSql } from '../../scripts/build-seed-sql';

import { CURRICULUM } from './curriculum';
import { SAMPLE_QCMS } from './sample-qcms';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('translations', () => {
  it('French and English catalogs have the same keys', () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });
});

describe('starter content', () => {
  it('has unique ids and module codes per curriculum', () => {
    const ids = [
      ...CURRICULUM.map((m) => m.id),
      ...CURRICULUM.flatMap((m) => m.units.map((u) => u.id)),
      ...CURRICULUM.flatMap((m) => m.units.flatMap((u) => u.courses.map((c) => c.id))),
      ...SAMPLE_QCMS.map((q) => q.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    const codes = CURRICULUM.map((m) => `${m.major}/${m.studyYear}/${m.code}`);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('covers every major and year with at least 3 questions', () => {
    for (const major of ['medicine', 'dentistry', 'pharmacy'] as const) {
      for (const year of [1, 2] as const) {
        const modules = CURRICULUM.filter((m) => m.major === major && m.studyYear === year).map((m) => m.id);
        expect(SAMPLE_QCMS.filter((q) => modules.includes(q.moduleId)).length, `${major} L${year}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('only contains answerable questions', () => {
    for (const q of SAMPLE_QCMS) {
      const correct = q.options.filter((o) => o.isCorrect).length;
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(2);
      expect(correct, q.id).toBeGreaterThanOrEqual(1);
      if (q.type === 'single') expect(correct, q.id).toBe(1);
    }
  });

  it('supabase/seed.sql is up to date (run `npm run db:seed:generate`)', () => {
    const onDisk = readFileSync(new URL('../../supabase/seed.sql', import.meta.url), 'utf8');
    expect(onDisk).toBe(buildSeedSql());
  });
});
