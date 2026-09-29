import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import { buildSeedSql } from '../../scripts/build-seed-sql';

import { CURRICULUM } from './curriculum';
import { AI_EXPLANATIONS, IMPORTED_QCMS } from './imported';
import { PUBLISHED_QCMS, SEED_QCMS } from './questions';

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
      ...SEED_QCMS.map((q) => q.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    const codes = CURRICULUM.map((m) => `${m.major}/${m.studyYear}/${m.code}`);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('covers every major and year with at least 3 questions', () => {
    for (const major of ['medicine', 'dentistry', 'pharmacy'] as const) {
      for (const year of [1, 2] as const) {
        const modules = CURRICULUM.filter((m) => m.major === major && m.studyYear === year).map((m) => m.id);
        expect(PUBLISHED_QCMS.filter((q) => modules.includes(q.moduleId)).length, `${major} L${year}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('only publishes answerable questions', () => {
    for (const q of PUBLISHED_QCMS) {
      const correct = q.options.filter((o) => o.isCorrect).length;
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(2);
      expect(correct, q.id).toBeGreaterThanOrEqual(1);
      if (q.type === 'single') expect(correct, q.id).toBe(1);
    }
  });

  it('imports the UMMTO banks, keeping unsafe questions as explained drafts', () => {
    const published = IMPORTED_QCMS.filter((q) => q.status === 'published');
    expect(published.length).toBeGreaterThan(800);
    for (const q of IMPORTED_QCMS) {
      expect(q.stem.length, q.id).toBeGreaterThan(3);
      if (q.status === 'draft') {
        expect(q.explanation, q.id).toMatch(/^\[À revoir avant publication/);
        expect(q.tags.some((t) => t.startsWith('a-revoir:')), q.id).toBe(true);
      } else {
        // Published imports state their source; an explanation, if any, is labelled as AI-written.
        expect(q.source, q.id).toMatch(/^UMMTO/);
        expect(q.tags.filter((t) => t !== 'explication:ia'), q.id).toEqual(['import:ummto-2023-24']);
        if (q.explanation) expect(q.explanation, q.id).toMatch(/Explication rédigée par IA/);
      }
    }
  });

  it('attaches AI explanations only to existing questions and propositions', () => {
    const byId = new Map(IMPORTED_QCMS.map((q) => [q.id, q]));
    for (const [id, ai] of Object.entries(AI_EXPLANATIONS)) {
      const q = byId.get(id);
      expect(q, `explanation for unknown question ${id}`).toBeDefined();
      expect(ai.why.length, id).toBeGreaterThan(20);
      for (const label of Object.keys(ai.options)) {
        expect(q!.options.some((o) => o.label === label), `${id} option ${label}`).toBe(true);
      }
      if (ai.keyIssue) expect(q!.status, id).toBe('draft');
    }
  });

  it('only publishes QCS with a single correct answer', () => {
    for (const q of PUBLISHED_QCMS.filter((x) => x.type === 'single')) {
      expect(q.options.filter((o) => o.isCorrect), q.id).toHaveLength(1);
    }
  });

  it('supabase/seed.sql is up to date (run `npm run db:seed:generate`)', () => {
    const onDisk = readFileSync(new URL('../../supabase/seed.sql', import.meta.url), 'utf8');
    expect(onDisk).toBe(buildSeedSql());
  });
});
