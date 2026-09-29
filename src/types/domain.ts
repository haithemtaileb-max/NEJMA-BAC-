/**
 * Domain types shared by server and client code.
 *
 * These are the shapes the UI works with (camelCase, localised text grouped),
 * not raw database rows — the data layer in `src/server/data` maps rows to them.
 */

export const MAJORS = ['medicine', 'dentistry', 'pharmacy'] as const;
export type Major = (typeof MAJORS)[number];

export const STUDY_YEARS = [1, 2] as const;
export type StudyYear = (typeof STUDY_YEARS)[number];

export type UserRole = 'student' | 'contributor' | 'moderator' | 'admin';

/** Text stored in both languages. French is the reference language of the curriculum. */
export interface LocalizedText {
  fr: string;
  en: string;
}

export interface Profile {
  id: string;
  displayName: string | null;
  major: Major | null;
  studyYear: StudyYear | null;
  locale: 'fr' | 'en';
  role: UserRole;
}

/** A profile that completed onboarding — what every page inside the app shell receives. */
export type OnboardedProfile = Profile & { major: Major; studyYear: StudyYear };

export function isOnboarded(profile: Profile | null): profile is OnboardedProfile {
  return profile?.major != null && profile.studyYear != null;
}

// -----------------------------------------------------------------------------
// Curriculum
// -----------------------------------------------------------------------------

export interface Module {
  id: string;
  major: Major;
  studyYear: StudyYear;
  code: string;
  title: LocalizedText;
  description: LocalizedText | null;
  /** L2 "Unité d'enseignement intégrée" (e.g. Appareil cardio-respiratoire). */
  isIntegrated: boolean;
  /** 1 or 2, null for annual modules. */
  semester: 1 | 2 | null;
  icon: string;
  color: ModuleColor;
  sortOrder: number;
}

export const MODULE_COLORS = [
  'rose', 'orange', 'amber', 'lime', 'emerald', 'teal', 'cyan', 'sky', 'indigo', 'violet', 'fuchsia', 'slate',
] as const;
export type ModuleColor = (typeof MODULE_COLORS)[number];

export interface Unit {
  id: string;
  moduleId: string;
  title: LocalizedText;
  sortOrder: number;
}

export interface Course {
  id: string;
  unitId: string;
  moduleId: string;
  slug: string;
  title: LocalizedText;
  sortOrder: number;
}

export interface CourseWithCount extends Course {
  questionCount: number;
}

export interface UnitWithCourses extends Unit {
  courses: CourseWithCount[];
}

// -----------------------------------------------------------------------------
// QCM
// -----------------------------------------------------------------------------

export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type OptionLabel = (typeof OPTION_LABELS)[number];

/** `single` = QCS (one answer), `multiple` = QCM (one or more answers). */
export type QcmType = 'single' | 'multiple';

export type ScoringMode = 'all_or_nothing' | 'partial';

export interface QcmOption {
  label: OptionLabel;
  body: string;
}

/** A question as a student sees it before answering: no key, no explanation. */
export interface Qcm {
  id: string;
  courseId: string;
  moduleId: string;
  type: QcmType;
  stem: string;
  options: QcmOption[];
  difficulty: number | null;
  source: string | null;
}

/** Returned once an answer is committed in practice mode. */
export interface AnswerFeedback {
  isCorrect: boolean;
  /** Partial-credit score in [0, 1]. */
  score: number;
  correct: OptionLabel[];
  explanation: string | null;
  optionExplanations: Partial<Record<OptionLabel, string>>;
}

export type ReportReason = 'wrong_answer' | 'ambiguous' | 'typo' | 'outdated' | 'other';

// -----------------------------------------------------------------------------
// Exam simulator
// -----------------------------------------------------------------------------

export type ExamStatus = 'in_progress' | 'submitted' | 'expired';

export interface ExamQuestion extends Omit<Qcm, 'difficulty' | 'source'> {
  position: number;
  selected: OptionLabel[];
  flagged: boolean;
}

export interface ExamPaper {
  sessionId: string;
  status: ExamStatus;
  startedAt: string;
  expiresAt: string;
  /** Server clock at render time — the client corrects its own clock skew with it. */
  serverNow: string;
  durationSeconds: number;
  scoringMode: ScoringMode;
  questions: ExamQuestion[];
}

export interface ModuleBreakdown {
  moduleId: string;
  title: LocalizedText;
  total: number;
  answered: number;
  correct: number;
  score: number;
}

export interface ReviewedOption extends QcmOption {
  isCorrect: boolean;
  explanation: string | null;
}

export interface ReviewedQuestion {
  position: number;
  qcmId: string;
  moduleId: string;
  type: QcmType;
  stem: string;
  explanation: string | null;
  selected: OptionLabel[];
  isCorrect: boolean;
  score: number;
  options: ReviewedOption[];
}

export interface ExamResult {
  sessionId: string;
  status: ExamStatus;
  scoringMode: ScoringMode;
  startedAt: string;
  submittedAt: string | null;
  durationSeconds: number;
  questionCount: number;
  score: number;
  /** Note sur 20 — the grading scale used in Algerian faculties. */
  score20: number;
  modules: ModuleBreakdown[];
  questions: ReviewedQuestion[];
}

export interface ExamSessionSummary {
  id: string;
  status: ExamStatus;
  questionCount: number;
  score20: number | null;
  startedAt: string;
}

// -----------------------------------------------------------------------------
// 3D anatomy
// -----------------------------------------------------------------------------

export interface AnatomyModel {
  id: string;
  slug: string;
  title: LocalizedText;
  system: string;
  /** GLB/GLTF URL, or `sketchfab:<model id>` to embed a Sketchfab viewer instead. */
  modelUrl: string;
  license: string;
  attribution: string;
  /** Mesh name → localised label. */
  structures: Record<string, LocalizedText>;
}

// -----------------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------------

export interface ModuleProgress {
  moduleId: string;
  attempts: number;
  correct: number;
  /** Mean partial score × 100, null when never attempted. */
  accuracyPct: number | null;
}

export interface DashboardData {
  modules: Array<Module & { questionCount: number; progress: ModuleProgress | null }>;
  totals: {
    answered: number;
    accuracyPct: number | null;
    examsTaken: number;
    bestScore20: number | null;
  };
  recentExams: ExamSessionSummary[];
}
