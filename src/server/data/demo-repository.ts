import 'server-only';

import { cookies } from 'next/headers';

import { CURRICULUM, type CurriculumModule } from '@/content/curriculum';
import { PUBLISHED_QCMS, type SampleQcm } from '@/content/questions';
import { SUBMIT_GRACE_SECONDS } from '@/lib/qcm/exam-config';
import { drawBalanced } from '@/lib/qcm/exam-draw';
import { normalizeLabels, sameLabels, scoreQuestion, toScore20 } from '@/lib/qcm/scoring';
import {
  MAJORS,
  type ExamResult,
  type ExamStatus,
  type Major,
  type Module,
  type OptionLabel,
  type Profile,
  type Qcm,
  type ScoringMode,
  type StudyYear,
} from '@/types/domain';

import { DataError, type Repository } from './repository';

/**
 * Demo mode: the whole app on bundled sample content, no Supabase needed.
 *
 * - The chosen major/year lives in a cookie.
 * - Attempts, bookmarks and exams live in server memory (one shared demo
 *   student) and vanish on restart. Fine for `npm run dev`, not for production.
 */

const PROFILE_COOKIE = 'nejma_demo_profile';

interface DemoExam {
  id: string;
  moduleIds: string[];
  scoringMode: ScoringMode;
  startedAt: Date;
  expiresAt: Date;
  durationSeconds: number;
  status: ExamStatus;
  submittedAt: Date | null;
  questions: Array<{ position: number; qcm: SampleQcm; selected: OptionLabel[]; flagged: boolean; score: number; isCorrect: boolean }>;
}

interface DemoStore {
  attempts: Array<{ qcmId: string; moduleId: string; isCorrect: boolean; score: number }>;
  bookmarks: Set<string>;
  reports: Set<string>;
  exams: Map<string, DemoExam>;
}

// globalThis survives hot reloads in development.
const store: DemoStore = ((globalThis as { __nejmaDemo?: DemoStore }).__nejmaDemo ??= {
  attempts: [],
  bookmarks: new Set(),
  reports: new Set(),
  exams: new Map(),
});

const toModule = (m: CurriculumModule, index: number): Module => ({
  id: m.id,
  major: m.major,
  studyYear: m.studyYear,
  code: m.code,
  title: m.title,
  description: null,
  isIntegrated: m.isIntegrated,
  semester: m.semester,
  icon: m.icon,
  color: m.color,
  sortOrder: index,
});

const toQcm = (q: SampleQcm): Qcm => ({
  id: q.id,
  courseId: q.courseId,
  moduleId: q.moduleId,
  type: q.type,
  stem: q.stem,
  difficulty: q.difficulty,
  source: q.source,
  options: q.options.map(({ label, body }) => ({ label, body })),
});

const keyOf = (q: SampleQcm) => q.options.filter((o) => o.isCorrect).map((o) => o.label);

/** Keep only labels that exist for the question (same rule as the SQL). */
const existingLabels = (q: SampleQcm, labels: readonly string[]) =>
  normalizeLabels(labels).filter((l) => q.options.some((o) => o.label === l));

async function readProfile(): Promise<Profile> {
  const raw = (await cookies()).get(PROFILE_COOKIE)?.value ?? '';
  const [major, year] = raw.split(':');
  const valid = (MAJORS as readonly string[]).includes(major) && (year === '1' || year === '2');
  return {
    id: 'demo-student',
    displayName: 'Étudiant·e démo',
    major: valid ? (major as Major) : null,
    studyYear: valid ? (Number(year) as StudyYear) : null,
    locale: 'fr',
    role: 'student',
  };
}

function findExam(sessionId: string): DemoExam {
  const exam = store.exams.get(sessionId);
  if (!exam) throw new DataError('EXAM_NOT_FOUND');
  return exam;
}

function buildResult(exam: DemoExam): ExamResult {
  const modules = CURRICULUM.map(toModule).filter((m) => exam.questions.some((q) => q.qcm.moduleId === m.id));
  const score = exam.questions.reduce((sum, q) => sum + q.score, 0);
  return {
    sessionId: exam.id,
    status: exam.status,
    scoringMode: exam.scoringMode,
    startedAt: exam.startedAt.toISOString(),
    submittedAt: exam.submittedAt?.toISOString() ?? null,
    durationSeconds: exam.durationSeconds,
    questionCount: exam.questions.length,
    score: Math.round(score * 100) / 100,
    score20: toScore20(score, exam.questions.length),
    modules: modules.map((m) => {
      const qs = exam.questions.filter((q) => q.qcm.moduleId === m.id);
      return {
        moduleId: m.id,
        title: m.title,
        total: qs.length,
        answered: qs.filter((q) => q.selected.length > 0).length,
        correct: qs.filter((q) => q.isCorrect).length,
        score: Math.round(qs.reduce((sum, q) => sum + q.score, 0) * 100) / 100,
      };
    }),
    questions: exam.questions.map((q) => ({
      position: q.position,
      qcmId: q.qcm.id,
      moduleId: q.qcm.moduleId,
      type: q.qcm.type,
      stem: q.qcm.stem,
      explanation: q.qcm.explanation,
      selected: q.selected,
      isCorrect: q.isCorrect,
      score: q.score,
      options: q.qcm.options.map((o) => ({ label: o.label, body: o.body, isCorrect: o.isCorrect, explanation: o.explanation })),
    })),
  };
}

export const demoRepository: Repository = {
  getCurrentProfile: readProfile,

  async setCurriculum(major, studyYear) {
    (await cookies()).set(PROFILE_COOKIE, `${major}:${studyYear}`, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  },

  async listModules(major, studyYear) {
    return CURRICULUM.map(toModule)
      .filter((m) => m.major === major && m.studyYear === studyYear)
      .map((m) => ({ ...m, questionCount: PUBLISHED_QCMS.filter((q) => q.moduleId === m.id).length }));
  },

  async getModule(moduleId) {
    const index = CURRICULUM.findIndex((m) => m.id === moduleId);
    return index >= 0 ? toModule(CURRICULUM[index], index) : null;
  },

  async listUnitsWithCourses(moduleId) {
    const mod = CURRICULUM.find((m) => m.id === moduleId);
    return (mod?.units ?? []).map((u, ui) => ({
      id: u.id,
      moduleId,
      title: u.title,
      sortOrder: ui,
      courses: u.courses.map((c, ci) => ({
        id: c.id,
        unitId: u.id,
        moduleId,
        slug: c.slug,
        title: c.title,
        sortOrder: ci,
        questionCount: PUBLISHED_QCMS.filter((q) => q.courseId === c.id).length,
      })),
    }));
  },

  async getCourse(courseId) {
    for (const [index, m] of CURRICULUM.entries()) {
      for (const u of m.units) {
        const c = u.courses.find((x) => x.id === courseId);
        if (c) {
          return {
            course: { id: c.id, unitId: u.id, moduleId: m.id, slug: c.slug, title: c.title, sortOrder: 0 },
            module: toModule(m, index),
          };
        }
      }
    }
    return null;
  },

  async listCourseQuestions(courseId) {
    return PUBLISHED_QCMS.filter((q) => q.courseId === courseId).map(toQcm);
  },

  async answerQuestion(qcmId, selected) {
    const q = PUBLISHED_QCMS.find((x) => x.id === qcmId);
    if (!q) throw new DataError('QCM_NOT_FOUND');
    const answer = normalizeLabels(selected);
    if (answer.length === 0 || existingLabels(q, answer).length !== answer.length) throw new DataError('INVALID_SELECTION');
    if (q.type === 'single' && answer.length > 1) throw new DataError('SINGLE_CHOICE_EXPECTED');

    const correct = keyOf(q);
    const isCorrect = sameLabels(answer, correct);
    const score = scoreQuestion(q.type, correct, answer, 'partial');
    store.attempts.push({ qcmId, moduleId: q.moduleId, isCorrect, score });

    return {
      isCorrect,
      score,
      correct,
      explanation: q.explanation,
      optionExplanations: Object.fromEntries(q.options.filter((o) => o.explanation).map((o) => [o.label, o.explanation!])),
    };
  },

  async listBookmarkedIds(qcmIds) {
    return qcmIds.filter((id) => store.bookmarks.has(id));
  },

  async setBookmark(qcmId, bookmarked) {
    if (bookmarked) store.bookmarks.add(qcmId);
    else store.bookmarks.delete(qcmId);
  },

  async reportQuestion(qcmId) {
    if (store.reports.has(qcmId)) throw new DataError('ALREADY_REPORTED');
    store.reports.add(qcmId);
  },

  async startExam({ moduleIds, questionCount, durationSeconds, scoringMode }) {
    const profile = await readProfile();
    if (!profile.major || !profile.studyYear) throw new DataError('ONBOARDING_REQUIRED');

    const own = CURRICULUM.filter((m) => m.major === profile.major && m.studyYear === profile.studyYear).map((m) => m.id);
    const selected = moduleIds.length ? own.filter((id) => moduleIds.includes(id)) : own;
    if (selected.length === 0) throw new DataError('INVALID_MODULES');

    const paper = drawBalanced(PUBLISHED_QCMS.filter((q) => selected.includes(q.moduleId)), questionCount);
    if (paper.length === 0) throw new DataError('NO_QUESTIONS_AVAILABLE');

    // Smaller pool than requested: keep the per-question pace.
    const duration = Math.max(60, Math.floor((durationSeconds * paper.length) / questionCount));
    const startedAt = new Date();
    const id = crypto.randomUUID();
    store.exams.set(id, {
      id,
      moduleIds: selected,
      scoringMode,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + duration * 1000),
      durationSeconds: duration,
      status: 'in_progress',
      submittedAt: null,
      questions: paper.map((qcm, i) => ({ position: i + 1, qcm, selected: [], flagged: false, score: 0, isCorrect: false })),
    });
    return id;
  },

  async getExamPaper(sessionId) {
    const exam = store.exams.get(sessionId);
    if (!exam) return null;
    return {
      sessionId: exam.id,
      status: exam.status,
      startedAt: exam.startedAt.toISOString(),
      expiresAt: exam.expiresAt.toISOString(),
      serverNow: new Date().toISOString(),
      durationSeconds: exam.durationSeconds,
      scoringMode: exam.scoringMode,
      questions: exam.questions.map((q) => ({
        id: q.qcm.id,
        courseId: q.qcm.courseId,
        moduleId: q.qcm.moduleId,
        type: q.qcm.type,
        stem: q.qcm.stem,
        options: q.qcm.options.map(({ label, body }) => ({ label, body })),
        position: q.position,
        selected: q.selected,
        flagged: q.flagged,
      })),
    };
  },

  async saveExamAnswer(sessionId, position, selected, flagged) {
    const exam = findExam(sessionId);
    const question = exam.questions.find((q) => q.position === position);
    if (exam.status !== 'in_progress' || Date.now() > exam.expiresAt.getTime() || !question) {
      throw new DataError('EXAM_NOT_WRITABLE');
    }
    question.selected = existingLabels(question.qcm, selected);
    question.flagged = flagged;
  },

  async submitExam(sessionId, answers) {
    const exam = findExam(sessionId);
    if (exam.status !== 'in_progress') return buildResult(exam);

    const late = Date.now() > exam.expiresAt.getTime() + SUBMIT_GRACE_SECONDS * 1000;
    for (const q of exam.questions) {
      if (!late && answers[q.position]) q.selected = existingLabels(q.qcm, answers[q.position]);
      const key = keyOf(q.qcm);
      q.score = scoreQuestion(q.qcm.type, key, q.selected, exam.scoringMode);
      q.isCorrect = sameLabels(q.selected, key);
      if (q.selected.length > 0) store.attempts.push({ qcmId: q.qcm.id, moduleId: q.qcm.moduleId, isCorrect: q.isCorrect, score: q.score });
    }
    exam.status = late ? 'expired' : 'submitted';
    exam.submittedAt = new Date();
    return buildResult(exam);
  },

  async getExamResult(sessionId) {
    const exam = store.exams.get(sessionId);
    if (!exam) return null;
    if (exam.status === 'in_progress') throw new DataError('EXAM_IN_PROGRESS');
    return buildResult(exam);
  },

  async getDashboard(profile) {
    const modules = await demoRepository.listModules(profile.major, profile.studyYear);
    const finished = [...store.exams.values()].filter((e) => e.status !== 'in_progress').map(buildResult);
    const answered = store.attempts.length;
    const scoreSum = store.attempts.reduce((sum, a) => sum + a.score, 0);

    return {
      modules: modules.map((m) => {
        const attempts = store.attempts.filter((a) => a.moduleId === m.id);
        return {
          ...m,
          progress: attempts.length
            ? {
                moduleId: m.id,
                attempts: attempts.length,
                correct: attempts.filter((a) => a.isCorrect).length,
                accuracyPct: Math.round((attempts.reduce((s, a) => s + a.score, 0) / attempts.length) * 1000) / 10,
              }
            : null,
        };
      }),
      totals: {
        answered,
        accuracyPct: answered ? Math.round((scoreSum / answered) * 1000) / 10 : null,
        examsTaken: finished.length,
        bestScore20: finished.length ? Math.max(...finished.map((r) => r.score20)) : null,
      },
      recentExams: [...store.exams.values()]
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, 5)
        .map((e) => ({
          id: e.id,
          status: e.status,
          questionCount: e.questions.length,
          score20: e.status === 'in_progress' ? null : buildResult(e).score20,
          startedAt: e.startedAt.toISOString(),
        })),
    };
  },

  // Demo mode ships no GLB file: the viewer falls back to its procedural skeleton.
  async listAnatomyModels() {
    return [];
  },
};
