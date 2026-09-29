import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';
import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  AnatomyModel,
  AnswerFeedback,
  Course,
  ExamPaper,
  ExamResult,
  ExamStatus,
  Major,
  Module,
  ModuleColor,
  OptionLabel,
  Profile,
  Qcm,
  QcmType,
  ScoringMode,
  StudyYear,
  UserRole,
} from '@/types/domain';

import { DATA_ERROR_CODES, DataError, type Repository } from './repository';

// -----------------------------------------------------------------------------
// Row shapes (snake_case, as PostgREST returns them) and mappers
// -----------------------------------------------------------------------------

const MODULE_COLUMNS = 'id, major, study_year, code, title_fr, title_en, description_fr, description_en, is_integrated, semester, icon, color, sort_order';
const COURSE_COLUMNS = 'id, unit_id, module_id, slug, title_fr, title_en, sort_order';

interface ModuleRow {
  id: string;
  major: Major;
  study_year: StudyYear;
  code: string;
  title_fr: string;
  title_en: string;
  description_fr: string | null;
  description_en: string | null;
  is_integrated: boolean;
  semester: 1 | 2 | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

interface CourseRow {
  id: string;
  unit_id: string;
  module_id: string;
  slug: string;
  title_fr: string;
  title_en: string;
  sort_order: number;
}

interface QuestionJson {
  position: number;
  qcm_id: string;
  module_id: string;
  course_id?: string;
  type: QcmType;
  stem: string;
  selected: OptionLabel[];
  flagged?: boolean;
  explanation?: string | null;
  is_correct?: boolean;
  score?: number;
  options: Array<{ label: OptionLabel; body: string; is_correct?: boolean; explanation?: string | null }>;
}

const mapModule = (r: ModuleRow): Module => ({
  id: r.id,
  major: r.major,
  studyYear: r.study_year,
  code: r.code,
  title: { fr: r.title_fr, en: r.title_en },
  description: r.description_fr ? { fr: r.description_fr, en: r.description_en ?? r.description_fr } : null,
  isIntegrated: r.is_integrated,
  semester: r.semester,
  icon: r.icon ?? 'book-open',
  color: (r.color ?? 'slate') as ModuleColor,
  sortOrder: r.sort_order,
});

const mapCourse = (r: CourseRow): Course => ({
  id: r.id,
  unitId: r.unit_id,
  moduleId: r.module_id,
  slug: r.slug,
  title: { fr: r.title_fr, en: r.title_en },
  sortOrder: r.sort_order,
});

function mapPaper(json: Record<string, unknown>): ExamPaper {
  return {
    sessionId: json.session_id as string,
    status: json.status as ExamStatus,
    startedAt: json.started_at as string,
    expiresAt: json.expires_at as string,
    serverNow: json.server_now as string,
    durationSeconds: json.duration_seconds as number,
    scoringMode: json.scoring_mode as ScoringMode,
    questions: (json.questions as QuestionJson[]).map((q) => ({
      position: q.position,
      id: q.qcm_id,
      moduleId: q.module_id,
      courseId: q.course_id ?? '',
      type: q.type,
      stem: q.stem,
      options: q.options.map(({ label, body }) => ({ label, body })),
      selected: q.selected,
      flagged: q.flagged ?? false,
    })),
  };
}

function mapResult(json: Record<string, unknown>): ExamResult {
  const modules = json.modules as Array<Record<string, unknown>>;
  return {
    sessionId: json.session_id as string,
    status: json.status as ExamStatus,
    scoringMode: json.scoring_mode as ScoringMode,
    startedAt: json.started_at as string,
    submittedAt: (json.submitted_at as string | null) ?? null,
    durationSeconds: json.duration_seconds as number,
    questionCount: json.question_count as number,
    score: Number(json.score ?? 0),
    score20: Number(json.score_20 ?? 0),
    modules: modules.map((m) => ({
      moduleId: m.module_id as string,
      title: { fr: m.title_fr as string, en: m.title_en as string },
      total: Number(m.total),
      answered: Number(m.answered),
      correct: Number(m.correct),
      score: Number(m.score),
    })),
    questions: (json.questions as QuestionJson[]).map((q) => ({
      position: q.position,
      qcmId: q.qcm_id,
      moduleId: q.module_id,
      type: q.type,
      stem: q.stem,
      explanation: q.explanation ?? null,
      selected: q.selected,
      isCorrect: Boolean(q.is_correct),
      score: Number(q.score ?? 0),
      options: q.options.map((o) => ({
        label: o.label,
        body: o.body,
        isCorrect: Boolean(o.is_correct),
        explanation: o.explanation ?? null,
      })),
    })),
  };
}

/** Turn a PostgREST error into a DataError, recognising the codes our SQL functions raise. */
function fail(error: PostgrestError): never {
  if (error.code === '23505') throw new DataError('ALREADY_REPORTED', error);
  const code = DATA_ERROR_CODES.find((c) => error.message?.includes(c)) ?? 'UNKNOWN';
  if (code === 'UNKNOWN') console.error('[supabase]', error);
  throw new DataError(code, error);
}

function unwrap<T>({ data, error }: { data: T | null; error: PostgrestError | null }): T {
  if (error) fail(error);
  return data as T;
}

// -----------------------------------------------------------------------------

async function currentUserId(): Promise<string> {
  const profile = await getCurrentProfile();
  if (!profile) throw new DataError('NOT_AUTHENTICATED');
  return profile.id;
}

/** Cached for the duration of one request (layout + page share it). */
const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const row = unwrap(
    await supabase
      .from('profiles')
      .select('id, display_name, major, study_year, locale, role')
      .eq('id', userId)
      .maybeSingle<{ id: string; display_name: string | null; major: Major | null; study_year: StudyYear | null; locale: 'fr' | 'en'; role: UserRole }>(),
  );
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    major: row.major,
    studyYear: row.study_year,
    locale: row.locale,
    role: row.role,
  };
});

export const supabaseRepository: Repository = {
  getCurrentProfile,

  async setCurriculum(major, studyYear) {
    const userId = await currentUserId();
    const supabase = await createSupabaseServerClient();
    unwrap(await supabase.from('profiles').update({ major, study_year: studyYear }).eq('id', userId));
  },

  async listModules(major, studyYear) {
    const supabase = await createSupabaseServerClient();
    const modules = unwrap(
      await supabase.from('modules').select(MODULE_COLUMNS).eq('major', major).eq('study_year', studyYear).order('sort_order').overrideTypes<ModuleRow[], { merge: false }>(),
    );
    const counts = unwrap(
      await supabase
        .from('course_question_counts')
        .select('module_id, question_count')
        .in('module_id', modules.map((m) => m.id))
        .overrideTypes<Array<{ module_id: string; question_count: number }>, { merge: false }>(),
    );
    return modules.map((row) => ({
      ...mapModule(row),
      questionCount: counts.filter((c) => c.module_id === row.id).reduce((sum, c) => sum + Number(c.question_count), 0),
    }));
  },

  async getModule(moduleId) {
    const supabase = await createSupabaseServerClient();
    const row = unwrap(await supabase.from('modules').select(MODULE_COLUMNS).eq('id', moduleId).maybeSingle<ModuleRow>());
    return row ? mapModule(row) : null;
  },

  async listUnitsWithCourses(moduleId) {
    const supabase = await createSupabaseServerClient();
    const [units, counts] = await Promise.all([
      supabase
        .from('units')
        .select(`id, module_id, title_fr, title_en, sort_order, courses (${COURSE_COLUMNS})`)
        .eq('module_id', moduleId)
        .order('sort_order')
        .order('sort_order', { referencedTable: 'courses' })
        .overrideTypes<Array<{ id: string; module_id: string; title_fr: string; title_en: string; sort_order: number; courses: CourseRow[] }>, { merge: false }>()
        .then(unwrap),
      supabase
        .from('course_question_counts')
        .select('course_id, question_count')
        .eq('module_id', moduleId)
        .overrideTypes<Array<{ course_id: string; question_count: number }>, { merge: false }>()
        .then(unwrap),
    ]);
    const countOf = new Map(counts.map((c) => [c.course_id, Number(c.question_count)]));
    return units.map((u) => ({
      id: u.id,
      moduleId: u.module_id,
      title: { fr: u.title_fr, en: u.title_en },
      sortOrder: u.sort_order,
      courses: u.courses.map((c) => ({ ...mapCourse(c), questionCount: countOf.get(c.id) ?? 0 })),
    }));
  },

  async getCourse(courseId) {
    const supabase = await createSupabaseServerClient();
    const course = unwrap(await supabase.from('courses').select(COURSE_COLUMNS).eq('id', courseId).maybeSingle<CourseRow>());
    if (!course) return null;
    const mod = await supabaseRepository.getModule(course.module_id);
    return mod ? { course: mapCourse(course), module: mod } : null;
  },

  async listCourseQuestions(courseId) {
    const supabase = await createSupabaseServerClient();
    // Column list is explicit on purpose: `explanation` and `is_correct` are not
    // selectable by students, so `select('*')` would be refused.
    const rows = unwrap(
      await supabase
        .from('qcms')
        .select('id, course_id, module_id, type, stem, difficulty, source, qcm_options (label, body)')
        .eq('course_id', courseId)
        .eq('status', 'published')
        .order('created_at')
        .order('label', { referencedTable: 'qcm_options' })
        .overrideTypes<Array<{ id: string; course_id: string; module_id: string; type: QcmType; stem: string; difficulty: number | null; source: string | null; qcm_options: Array<{ label: OptionLabel; body: string }> }>, { merge: false }>(),
    );
    return rows.map(
      (r): Qcm => ({
        id: r.id,
        courseId: r.course_id,
        moduleId: r.module_id,
        type: r.type,
        stem: r.stem,
        difficulty: r.difficulty,
        source: r.source,
        options: r.qcm_options,
      }),
    );
  },

  async answerQuestion(qcmId, selected, timeMs) {
    const supabase = await createSupabaseServerClient();
    const r = unwrap(
      await supabase.rpc('answer_qcm', { p_qcm_id: qcmId, p_selected: selected, p_time_ms: timeMs }),
    ) as { is_correct: boolean; score: number; correct: OptionLabel[]; explanation: string | null; option_explanations: Partial<Record<OptionLabel, string>> };
    const feedback: AnswerFeedback = {
      isCorrect: r.is_correct,
      score: Number(r.score),
      correct: r.correct,
      explanation: r.explanation,
      optionExplanations: r.option_explanations,
    };
    return feedback;
  },

  async listBookmarkedIds(qcmIds) {
    if (qcmIds.length === 0) return [];
    const supabase = await createSupabaseServerClient();
    const rows = unwrap(await supabase.from('bookmarks').select('qcm_id').in('qcm_id', qcmIds).overrideTypes<Array<{ qcm_id: string }>, { merge: false }>());
    return rows.map((r) => r.qcm_id);
  },

  async setBookmark(qcmId, bookmarked) {
    const userId = await currentUserId();
    const supabase = await createSupabaseServerClient();
    if (bookmarked) {
      unwrap(await supabase.from('bookmarks').upsert({ user_id: userId, qcm_id: qcmId }, { ignoreDuplicates: true }));
    } else {
      unwrap(await supabase.from('bookmarks').delete().eq('user_id', userId).eq('qcm_id', qcmId));
    }
  },

  async reportQuestion(qcmId, reason, message) {
    const userId = await currentUserId();
    const supabase = await createSupabaseServerClient();
    unwrap(await supabase.from('qcm_reports').insert({ qcm_id: qcmId, reporter_id: userId, reason, message }));
  },

  async startExam({ moduleIds, questionCount, durationSeconds, scoringMode }) {
    const supabase = await createSupabaseServerClient();
    return unwrap(
      await supabase.rpc('start_exam', {
        p_module_ids: moduleIds,
        p_question_count: questionCount,
        p_duration_seconds: durationSeconds,
        p_scoring: scoringMode,
      }),
    ) as string;
  },

  async getExamPaper(sessionId) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('get_exam_paper', { p_session_id: sessionId });
    if (error?.message.includes('EXAM_NOT_FOUND') || error?.code === '22P02') return null; // unknown or malformed id
    return mapPaper(unwrap({ data, error }));
  },

  async saveExamAnswer(sessionId, position, selected, flagged) {
    const supabase = await createSupabaseServerClient();
    unwrap(
      await supabase.rpc('save_exam_answer', { p_session_id: sessionId, p_position: position, p_selected: selected, p_flagged: flagged }),
    );
  },

  async submitExam(sessionId, answers) {
    const supabase = await createSupabaseServerClient();
    return mapResult(unwrap(await supabase.rpc('submit_exam', { p_session_id: sessionId, p_answers: answers })));
  },

  async getExamResult(sessionId) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('get_exam_result', { p_session_id: sessionId });
    if (error?.message.includes('EXAM_NOT_FOUND')) return null;
    return mapResult(unwrap({ data, error }));
  },

  async getDashboard(profile) {
    const supabase = await createSupabaseServerClient();
    const [modules, stats, recent, best, examCount] = await Promise.all([
      supabaseRepository.listModules(profile.major, profile.studyYear),
      supabase
        .from('user_module_stats')
        .select('module_id, attempts, correct, accuracy_pct')
        .eq('user_id', profile.id)
        .overrideTypes<Array<{ module_id: string; attempts: number; correct: number; accuracy_pct: number | null }>, { merge: false }>()
        .then(unwrap),
      supabase
        .from('exam_sessions')
        .select('id, status, question_count, score_20, started_at')
        .order('started_at', { ascending: false })
        .limit(5)
        .overrideTypes<Array<{ id: string; status: ExamStatus; question_count: number; score_20: number | null; started_at: string }>, { merge: false }>()
        .then(unwrap),
      supabase
        .from('exam_sessions')
        .select('score_20')
        .neq('status', 'in_progress')
        .order('score_20', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle<{ score_20: number | null }>()
        .then(unwrap),
      supabase.from('exam_sessions').select('id', { count: 'exact', head: true }).neq('status', 'in_progress'),
    ]);

    const statsByModule = new Map(stats.map((s) => [s.module_id, s]));
    const answered = stats.reduce((sum, s) => sum + Number(s.attempts), 0);
    const weightedAccuracy = stats.reduce((sum, s) => sum + Number(s.accuracy_pct ?? 0) * Number(s.attempts), 0);

    return {
      modules: modules.map((m) => {
        const s = statsByModule.get(m.id);
        return {
          ...m,
          progress: s
            ? { moduleId: m.id, attempts: Number(s.attempts), correct: Number(s.correct), accuracyPct: s.accuracy_pct === null ? null : Number(s.accuracy_pct) }
            : null,
        };
      }),
      totals: {
        answered,
        accuracyPct: answered ? Math.round((weightedAccuracy / answered) * 10) / 10 : null,
        examsTaken: examCount.count ?? 0,
        bestScore20: best?.score_20 == null ? null : Number(best.score_20),
      },
      recentExams: recent.map((e) => ({
        id: e.id,
        status: e.status,
        questionCount: e.question_count,
        score20: e.score_20 === null ? null : Number(e.score_20),
        startedAt: e.started_at,
      })),
    };
  },

  async listAnatomyModels() {
    const supabase = await createSupabaseServerClient();
    const rows = unwrap(
      await supabase
        .from('anatomy_models')
        .select('id, slug, title_fr, title_en, system, model_url, license, attribution, structures')
        .order('title_fr')
        .overrideTypes<Array<{ id: string; slug: string; title_fr: string; title_en: string; system: string; model_url: string; license: string; attribution: string; structures: AnatomyModel['structures'] }>, { merge: false }>(),
    );
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: { fr: r.title_fr, en: r.title_en },
      system: r.system,
      modelUrl: r.model_url,
      license: r.license,
      attribution: r.attribution,
      structures: r.structures ?? {},
    }));
  },
};
