/**
 * Integration tests for the Supabase schema: RLS, column privileges, RPCs.
 *
 * Runs the real migrations on a throw-away database of a plain PostgreSQL
 * server (with `supabase-shim.sql` standing in for Supabase's auth/storage).
 *
 *   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db
 */
import { readdirSync, readFileSync } from 'node:fs';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CURRICULUM, fixtureId } from '@/content/curriculum';
import { SAMPLE_QCMS } from '@/content/sample-qcms';
import { scoreQuestion } from '@/lib/qcm/scoring';
import type { QcmType, ScoringMode } from '@/types/domain';

const ADMIN_URL = process.env.TEST_DATABASE_URL;
const supabaseDir = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, supabaseDir), 'utf8');

type Query = (text: string, values?: unknown[]) => Promise<pg.QueryResult>;

describe.skipIf(!ADMIN_URL)('database schema', () => {
  const dbName = `nejma_test_${Date.now()}_${process.pid}`;
  let admin: pg.Client;
  let db: pg.Client;

  /** Run `fn` in a transaction as an API role, like PostgREST does for a request. */
  async function as<T>(uid: string | null, fn: (q: Query) => Promise<T>): Promise<T> {
    await db.query('begin');
    try {
      await db.query(`set local role ${uid ? 'authenticated' : 'anon'}`);
      if (uid) await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
      const result = await fn((text, values) => db.query(text, values));
      await db.query('commit');
      return result;
    } catch (error) {
      await db.query('rollback');
      throw error;
    }
  }

  async function signUp(meta: Record<string, string> = {}): Promise<string> {
    const { rows } = await db.query(
      `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
      [`student${Math.random().toString(36).slice(2)}@ummto.dz`, meta],
    );
    return rows[0].id;
  }

  async function onboardedStudent(major = 'medicine', year = 1): Promise<string> {
    const uid = await signUp();
    await as(uid, (q) => q('update public.profiles set major = $1, study_year = $2 where id = auth.uid()', [major, year]));
    return uid;
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`create database ${dbName}`);

    const url = new URL(ADMIN_URL!);
    url.pathname = `/${dbName}`;
    db = new pg.Client({ connectionString: url.toString() });
    await db.connect();

    await db.query(read('tests/supabase-shim.sql'));
    const migrations = readdirSync(new URL('migrations/', supabaseDir)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of migrations) await db.query(read(`migrations/${file}`));
    await db.query(read('seed.sql'));
  });

  afterAll(async () => {
    await db?.end();
    await admin?.query(`drop database if exists ${dbName} with (force)`);
    await admin?.end();
  });

  // ---------------------------------------------------------------------------

  it('loads the whole starter curriculum', async () => {
    const { rows } = await db.query('select (select count(*) from public.modules)::int as modules, (select count(*) from public.qcms)::int as qcms');
    expect(rows[0]).toEqual({ modules: CURRICULUM.length, qcms: SAMPLE_QCMS.length });
  });

  describe('profiles', () => {
    it('creates a profile on sign-up from auth metadata', async () => {
      const uid = await signUp({ display_name: 'Amina', locale: 'en' });
      const { rows } = await as(uid, (q) => q('select display_name, locale, role, major, onboarded_at from public.profiles'));
      expect(rows).toEqual([{ display_name: 'Amina', locale: 'en', role: 'student', major: null, onboarded_at: null }]);
    });

    it('stamps onboarded_at when major and year are chosen', async () => {
      const uid = await onboardedStudent('pharmacy', 2);
      const { rows } = await as(uid, (q) => q('select major, study_year, onboarded_at from public.profiles'));
      expect(rows[0]).toMatchObject({ major: 'pharmacy', study_year: 2 });
      expect(rows[0].onboarded_at).toBeInstanceOf(Date);
    });

    it('rejects a year outside L1/L2 and a major without a year', async () => {
      const uid = await signUp();
      await expect(as(uid, (q) => q("update public.profiles set major = 'medicine', study_year = 3 where id = auth.uid()"))).rejects.toThrow(/study_year/);
      await expect(as(uid, (q) => q("update public.profiles set major = 'medicine' where id = auth.uid()"))).rejects.toThrow(/profiles_major_year_together/);
    });

    it('does not let a student promote themselves', async () => {
      const uid = await signUp();
      await expect(as(uid, (q) => q("update public.profiles set role = 'admin' where id = auth.uid()"))).rejects.toThrow(/permission denied/);
    });

    it('hides other students’ profiles', async () => {
      const a = await signUp();
      await signUp();
      const { rows } = await as(a, (q) => q('select id from public.profiles'));
      expect(rows).toEqual([{ id: a }]);
    });
  });

  describe('answer keys stay secret', () => {
    it('lets students read stems and option bodies', async () => {
      const uid = await onboardedStudent();
      const { rows } = await as(uid, (q) => q('select qcm_id, label, body from public.qcm_options where qcm_id = $1 order by label', [fixtureId('qcm', 1)]));
      expect(rows.map((r) => r.label)).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it('refuses is_correct, option explanations and qcm explanations', async () => {
      const uid = await onboardedStudent();
      await expect(as(uid, (q) => q('select is_correct from public.qcm_options limit 1'))).rejects.toThrow(/permission denied/);
      await expect(as(uid, (q) => q('select explanation from public.qcm_options limit 1'))).rejects.toThrow(/permission denied/);
      await expect(as(uid, (q) => q('select explanation from public.qcms limit 1'))).rejects.toThrow(/permission denied/);
      await expect(as(uid, (q) => q('select * from public.qcms limit 1'))).rejects.toThrow(/permission denied/);
    });

    it('gives anonymous visitors the curriculum but no questions', async () => {
      const { rows } = await as(null, (q) => q('select count(*)::int as n from public.modules'));
      expect(rows[0].n).toBe(CURRICULUM.length);
      await expect(as(null, (q) => q('select id from public.qcms limit 1'))).rejects.toThrow(/permission denied/);
    });
  });

  describe('practice mode: answer_qcm', () => {
    const qcm = SAMPLE_QCMS.find((x) => x.id === fixtureId('qcm', 3))!; // A, B, E correct
    const key = qcm.options.filter((o) => o.isCorrect).map((o) => o.label);

    it('returns the correction and logs the attempt', async () => {
      const uid = await onboardedStudent();
      const { rows } = await as(uid, (q) => q('select public.answer_qcm($1, $2, 4200) as r', [qcm.id, ['a', 'b']]));
      expect(rows[0].r).toMatchObject({ is_correct: false, score: 0.6667, correct: key, explanation: qcm.explanation });
      expect(Object.keys(rows[0].r.option_explanations)).toEqual(['C', 'D']);

      const attempts = await as(uid, (q) => q('select mode, selected, is_correct, score::float, time_ms from public.qcm_attempts'));
      expect(attempts.rows).toEqual([{ mode: 'practice', selected: ['A', 'B'], is_correct: false, score: 0.6667, time_ms: 4200 }]);
    });

    it('rejects empty, unknown or multiple answers to a QCS', async () => {
      const uid = await onboardedStudent();
      const qcs = fixtureId('qcm', 2);
      await expect(as(uid, (q) => q('select public.answer_qcm($1, $2)', [qcm.id, []]))).rejects.toThrow(/INVALID_SELECTION/);
      await expect(as(uid, (q) => q('select public.answer_qcm($1, $2)', [qcm.id, ['F']]))).rejects.toThrow(/INVALID_SELECTION/);
      await expect(as(uid, (q) => q('select public.answer_qcm($1, $2)', [qcs, ['A', 'B']]))).rejects.toThrow(/SINGLE_CHOICE_EXPECTED/);
    });

    it('is not callable anonymously', async () => {
      await expect(as(null, (q) => q('select public.answer_qcm($1, $2)', [qcm.id, ['A']]))).rejects.toThrow(/permission denied/);
    });
  });

  describe('exam simulator', () => {
    const med1Modules = CURRICULUM.filter((m) => m.major === 'medicine' && m.studyYear === 1).map((m) => m.id);
    const med1Qcms = SAMPLE_QCMS.filter((q) => med1Modules.includes(q.moduleId));
    const keyOf = (qcmId: string) => SAMPLE_QCMS.find((q) => q.id === qcmId)!.options.filter((o) => o.isCorrect).map((o) => o.label);

    it('requires onboarding', async () => {
      const uid = await signUp();
      await expect(as(uid, (q) => q("select public.start_exam('{}', 10, 600)"))).rejects.toThrow(/ONBOARDING_REQUIRED/);
    });

    it('draws a paper from the student’s own curriculum, without answers', async () => {
      const uid = await onboardedStudent('medicine', 1);
      const paper = await as(uid, async (q) => {
        const { rows } = await q("select public.start_exam('{}', 10, 900) as id");
        return (await q('select public.get_exam_paper($1) as p', [rows[0].id])).rows[0].p;
      });

      expect(paper.status).toBe('in_progress');
      expect(paper.questions).toHaveLength(10);
      expect(paper.questions.map((x: { position: number }) => x.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      for (const question of paper.questions) {
        expect(med1Modules).toContain(question.module_id);
        expect(Object.keys(question.options[0]).sort()).toEqual(['body', 'label']);
      }
      expect(JSON.stringify(paper)).not.toMatch(/is_correct|explanation/);
    });

    it('balances questions across the selected modules', async () => {
      const uid = await onboardedStudent('medicine', 1);
      // Anatomie has 3 questions, Biochimie 3: a 4-question paper must take 2 + 2.
      const modules = [fixtureId('module', 1), fixtureId('module', 2)];
      const { rows } = await as(uid, async (q) => {
        const id = (await q('select public.start_exam($1, 4, 600) as id', [modules])).rows[0].id;
        return q('select module_id, count(*)::int as n from public.exam_session_questions where session_id = $1 group by 1', [id]);
      });
      expect(rows.map((r) => r.n)).toEqual([2, 2]);
    });

    it('ignores modules from another curriculum and shrinks the paper to the pool size', async () => {
      const uid = await onboardedStudent('pharmacy', 2);
      await expect(as(uid, (q) => q('select public.start_exam($1, 5, 600)', [[fixtureId('module', 1)]]))).rejects.toThrow(/INVALID_MODULES/);

      const { rows } = await as(uid, async (q) => {
        const id = (await q("select public.start_exam('{}', 40, 3600) as id")).rows[0].id;
        return q('select question_count, duration_seconds from public.exam_sessions where id = $1', [id]);
      });
      // Pharmacy L2 has 3 sample questions → 3 questions at the same pace (90 s each).
      expect(rows[0]).toEqual({ question_count: 3, duration_seconds: 270 });
    });

    it('autosaves, scores on submit, and is idempotent', async () => {
      const uid = await onboardedStudent('medicine', 1);
      const sessionId = await as(uid, async (q) => (await q("select public.start_exam('{}', $1, 1800) as id", [med1Qcms.length])).rows[0].id);
      const paper = await as(uid, async (q) => (await q('select public.get_exam_paper($1) as p', [sessionId])).rows[0].p);
      const [first, second, third] = paper.questions;

      // Q1 autosaved correct, Q2 sent at submit correct, Q3 wrong, the rest blank.
      await as(uid, (q) => q('select public.save_exam_answer($1, $2, $3, true)', [sessionId, first.position, keyOf(first.qcm_id)]));
      const answers = { [second.position]: keyOf(second.qcm_id), [third.position]: ['H'] };
      const result = await as(uid, async (q) => (await q('select public.submit_exam($1, $2) as r', [sessionId, answers])).rows[0].r);

      expect(result.status).toBe('submitted');
      expect(Number(result.score)).toBe(2);
      expect(Number(result.score_20)).toBeCloseTo((2 * 20) / med1Qcms.length, 2);
      expect(result.questions[0].options[0]).toHaveProperty('is_correct');
      expect(result.modules.reduce((sum: number, m: { total: number }) => sum + m.total, 0)).toBe(med1Qcms.length);
      expect(result.modules.reduce((sum: number, m: { answered: number }) => sum + m.answered, 0)).toBe(2); // 'H' is not a valid label

      const again = await as(uid, async (q) => (await q("select public.submit_exam($1, '{}'::jsonb) as r", [sessionId])).rows[0].r);
      expect(again.submitted_at).toBe(result.submitted_at);

      const attempts = await as(uid, (q) => q("select count(*)::int as n from public.qcm_attempts where mode = 'exam'"));
      expect(attempts.rows[0].n).toBe(2);

      await expect(as(uid, (q) => q('select public.save_exam_answer($1, 1, $2)', [sessionId, ['A']]))).rejects.toThrow(/EXAM_NOT_WRITABLE/);
    });

    it('marks late submissions as expired and ignores late answers', async () => {
      const uid = await onboardedStudent('medicine', 1);
      const sessionId = await as(uid, async (q) => (await q("select public.start_exam('{}', 3, 600) as id")).rows[0].id);
      await db.query(`update public.exam_sessions set started_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' where id = $1`, [sessionId]);

      const paper = await as(uid, async (q) => (await q('select public.get_exam_paper($1) as p', [sessionId])).rows[0].p);
      const late = { [paper.questions[0].position]: keyOf(paper.questions[0].qcm_id) };
      const result = await as(uid, async (q) => (await q('select public.submit_exam($1, $2) as r', [sessionId, late])).rows[0].r);
      expect(result.status).toBe('expired');
      expect(Number(result.score)).toBe(0);
    });

    it('keeps sessions private', async () => {
      const owner = await onboardedStudent('medicine', 1);
      const intruder = await onboardedStudent('medicine', 1);
      const sessionId = await as(owner, async (q) => (await q("select public.start_exam('{}', 3, 600) as id")).rows[0].id);

      const { rows } = await as(intruder, (q) => q('select id from public.exam_sessions'));
      expect(rows).toEqual([]);
      await expect(as(intruder, (q) => q('select public.get_exam_paper($1)', [sessionId]))).rejects.toThrow(/EXAM_NOT_FOUND/);
      await expect(as(intruder, (q) => q('select public.submit_exam($1)', [sessionId]))).rejects.toThrow(/EXAM_NOT_FOUND/);
      await expect(as(owner, (q) => q("update public.exam_sessions set score_20 = 20"))).rejects.toThrow(/permission denied/);
    });
  });

  describe('scoring parity (SQL ↔ TypeScript)', () => {
    const cases: Array<[QcmType, string[], string[]]> = [
      ['multiple', ['A', 'B', 'E'], ['A', 'B', 'E']],
      ['multiple', ['A', 'B', 'E'], ['e', 'b', 'a', 'a']],
      ['multiple', ['A', 'B', 'E'], ['A', 'B']],
      ['multiple', ['A', 'B', 'E'], ['A']],
      ['multiple', ['A', 'B', 'E'], ['A', 'C']],
      ['multiple', ['A', 'B', 'C', 'D'], ['A', 'B', 'C']],
      ['multiple', ['A'], ['A', 'B']],
      ['multiple', ['A', 'B'], []],
      ['multiple', ['A', 'B'], ['Z', 'A']],
      ['single', ['C'], ['C']],
      ['single', ['C'], ['D']],
      ['single', ['C'], ['C', 'D']],
    ];

    for (const mode of ['all_or_nothing', 'partial'] as ScoringMode[]) {
      it(`agrees in ${mode} mode`, async () => {
        for (const [type, key, selected] of cases) {
          const { rows } = await db.query('select private.qcm_score($1, $2, $3, $4)::float as s', [type, key, selected, mode]);
          expect(rows[0].s, `${type} ${key} ← ${selected}`).toBe(scoreQuestion(type, key, selected, mode));
        }
      });
    }
  });

  describe('moderation & integrity', () => {
    const courseId = fixtureId('course', 1);
    const moduleId = fixtureId('module', 1);

    it('lets contributors draft questions but not publish them', async () => {
      const uid = await onboardedStudent();
      await db.query("update public.profiles set role = 'contributor' where id = $1", [uid]);

      await as(uid, (q) => q("insert into public.qcms (course_id, module_id, stem, author_id) values ($1, $2, 'Brouillon', auth.uid())", [courseId, moduleId]));
      await expect(
        as(uid, (q) => q("insert into public.qcms (course_id, module_id, stem, author_id, status) values ($1, $2, 'x', auth.uid(), 'published')", [courseId, moduleId])),
      ).rejects.toThrow(/ONLY_MODERATORS_CAN_PUBLISH/);
    });

    it('students cannot write questions at all', async () => {
      const uid = await onboardedStudent();
      await expect(
        as(uid, (q) => q("insert into public.qcms (course_id, module_id, stem, author_id) values ($1, $2, 'x', auth.uid())", [courseId, moduleId])),
      ).rejects.toThrow(/row-level security/);
    });

    it('refuses to publish a QCS with two correct options', async () => {
      await expect(
        db.query(`
          begin;
          insert into public.qcms (id, course_id, module_id, type, stem, status)
            values ('00000000-0000-4000-9000-000000000001', '${courseId}', '${moduleId}', 'single', 'Invalide', 'published');
          insert into public.qcm_options (qcm_id, label, body, is_correct) values
            ('00000000-0000-4000-9000-000000000001', 'A', 'a', true),
            ('00000000-0000-4000-9000-000000000001', 'B', 'b', true);
          commit;`),
      ).rejects.toThrow(/exactly one correct option/);
      await db.query('rollback');
    });

    it('allows one open report per student per question', async () => {
      const uid = await onboardedStudent();
      const report = (q: Query) =>
        q("insert into public.qcm_reports (qcm_id, reporter_id, reason, message) values ($1, auth.uid(), 'wrong_answer', 'B est fausse')", [fixtureId('qcm', 1)]);
      await as(uid, report);
      await expect(as(uid, report)).rejects.toThrow(/qcm_reports_one_open_idx/);
    });
  });

  describe('flashcard decks', () => {
    it('keeps private decks private and shares unlisted decks by code', async () => {
      const owner = await onboardedStudent();
      const friend = await onboardedStudent();

      const { rows } = await as(owner, (q) =>
        q("insert into public.flashcard_decks (owner_id, title, visibility) values (auth.uid(), 'Os du carpe', 'unlisted') returning id, share_code"),
      );
      const deck = rows[0];
      await as(owner, (q) => q("insert into public.flashcards (deck_id, front, back) values ($1, 'Scaphoïde ?', 'Rangée proximale')", [deck.id]));

      expect((await as(friend, (q) => q('select id from public.flashcard_decks where id = $1', [deck.id]))).rows).toEqual([]);

      await as(friend, (q) => q('select public.add_deck_to_library($1)', [deck.share_code]));
      const visible = await as(friend, (q) => q('select d.card_count, count(c.id)::int as cards from public.flashcard_decks d join public.flashcards c on c.deck_id = d.id where d.id = $1 group by d.card_count', [deck.id]));
      expect(visible.rows).toEqual([{ card_count: 1, cards: 1 }]);

      await expect(as(friend, (q) => q("update public.flashcards set back = 'vandalisé' where deck_id = $1 returning id", [deck.id])).then((r) => r.rowCount)).resolves.toBe(0);
    });
  });
});
