/**
 * Renders the starter curriculum + sample QCMs as SQL.
 * Used by `npm run db:seed:generate` and by the DB test that checks
 * `supabase/seed.sql` is up to date.
 */
import { CURRICULUM } from '@/content/curriculum';
import { SAMPLE_QCMS } from '@/content/sample-qcms';

/** SQL literal: NULL, number, boolean, text (single quotes doubled) or text[]. */
function lit(value: string | number | boolean | null | readonly string[]): string {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? "'{}'" : `array[${value.map((v) => lit(v)).join(', ')}]`;
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insert(table: string, columns: string[], rows: Array<Array<Parameters<typeof lit>[0]>>): string {
  if (rows.length === 0) return '';
  const values = rows.map((row) => `  (${row.map(lit).join(', ')})`).join(',\n');
  return `insert into public.${table} (${columns.join(', ')}) values\n${values};\n`;
}

export function buildSeedSql(): string {
  const modules = CURRICULUM.map((m, i) => [
    m.id, m.major, m.studyYear, m.code, m.title.fr, m.title.en, m.isIntegrated, m.semester, m.icon, m.color, i + 1,
  ]);
  const units = CURRICULUM.flatMap((m) =>
    m.units.map((u, i) => [u.id, m.id, u.title.fr, u.title.en, i + 1]),
  );
  const courses = CURRICULUM.flatMap((m) =>
    m.units.flatMap((u) => u.courses.map((c, i) => [c.id, u.id, m.id, c.slug, c.title.fr, c.title.en, i + 1])),
  );
  const qcms = SAMPLE_QCMS.map((q) => [
    q.id, q.courseId, q.moduleId, q.type, q.stem, q.explanation, q.difficulty, q.source, q.tags, 'published',
  ]);
  const options = SAMPLE_QCMS.flatMap((q) =>
    q.options.map((o) => [q.id, o.label, o.body, o.isCorrect, o.explanation]),
  );

  return [
    '-- =============================================================================',
    '-- GENERATED FILE — do not edit by hand.',
    '-- Source: src/content/curriculum.ts + src/content/sample-qcms.ts',
    '-- Regenerate with: npm run db:seed:generate',
    '-- =============================================================================',
    '',
    'begin;',
    '',
    insert('modules', ['id', 'major', 'study_year', 'code', 'title_fr', 'title_en', 'is_integrated', 'semester', 'icon', 'color', 'sort_order'], modules),
    insert('units', ['id', 'module_id', 'title_fr', 'title_en', 'sort_order'], units),
    insert('courses', ['id', 'unit_id', 'module_id', 'slug', 'title_fr', 'title_en', 'sort_order'], courses),
    insert('qcms', ['id', 'course_id', 'module_id', 'type', 'stem', 'explanation', 'difficulty', 'source', 'tags', 'status'], qcms),
    insert('qcm_options', ['qcm_id', 'label', 'body', 'is_correct', 'explanation'], options),
    'commit;',
    '',
  ].join('\n');
}
