import type {
  AnatomyModel,
  AnswerFeedback,
  Course,
  DashboardData,
  ExamPaper,
  ExamResult,
  Major,
  Module,
  OnboardedProfile,
  OptionLabel,
  Profile,
  Qcm,
  ReportReason,
  ScoringMode,
  StudyYear,
  UnitWithCourses,
} from '@/types/domain';

/**
 * Everything the app reads or writes, behind one interface.
 *
 * Two implementations: Supabase (production) and an in-memory demo store used
 * when Supabase is not configured. Pages and Server Actions only talk to
 * `getRepository()`, so they never know which one is active.
 */
export interface Repository {
  // Profile
  getCurrentProfile(): Promise<Profile | null>;
  setCurriculum(major: Major, studyYear: StudyYear): Promise<void>;

  // Curriculum
  listModules(major: Major, studyYear: StudyYear): Promise<Array<Module & { questionCount: number }>>;
  getModule(moduleId: string): Promise<Module | null>;
  listUnitsWithCourses(moduleId: string): Promise<UnitWithCourses[]>;
  getCourse(courseId: string): Promise<{ course: Course; module: Module } | null>;

  // Practice
  listCourseQuestions(courseId: string): Promise<Qcm[]>;
  answerQuestion(qcmId: string, selected: OptionLabel[], timeMs: number | null): Promise<AnswerFeedback>;
  listBookmarkedIds(qcmIds: string[]): Promise<string[]>;
  setBookmark(qcmId: string, bookmarked: boolean): Promise<void>;
  reportQuestion(qcmId: string, reason: ReportReason, message: string | null): Promise<void>;

  // Exam simulator
  startExam(input: StartExamInput): Promise<string>;
  getExamPaper(sessionId: string): Promise<ExamPaper | null>;
  saveExamAnswer(sessionId: string, position: number, selected: OptionLabel[], flagged: boolean): Promise<void>;
  submitExam(sessionId: string, answers: Record<number, OptionLabel[]>): Promise<ExamResult>;
  getExamResult(sessionId: string): Promise<ExamResult | null>;

  // Dashboard
  getDashboard(profile: OnboardedProfile): Promise<DashboardData>;

  // 3D anatomy
  listAnatomyModels(): Promise<AnatomyModel[]>;
}

export interface StartExamInput {
  moduleIds: string[];
  questionCount: number;
  durationSeconds: number;
  scoringMode: ScoringMode;
}

/** Error codes surfaced to the UI (translated under `errors.*`). */
export const DATA_ERROR_CODES = [
  'NOT_AUTHENTICATED',
  'ONBOARDING_REQUIRED',
  'NO_QUESTIONS_AVAILABLE',
  'INVALID_MODULES',
  'INVALID_SELECTION',
  'SINGLE_CHOICE_EXPECTED',
  'QCM_NOT_FOUND',
  'EXAM_NOT_FOUND',
  'EXAM_NOT_WRITABLE',
  'EXAM_IN_PROGRESS',
  'ALREADY_REPORTED',
  'UNKNOWN',
] as const;
export type DataErrorCode = (typeof DATA_ERROR_CODES)[number];

export class DataError extends Error {
  constructor(public readonly code: DataErrorCode, cause?: unknown) {
    super(code, { cause });
    this.name = 'DataError';
  }
}

export function toDataErrorCode(error: unknown): DataErrorCode {
  if (error instanceof DataError) return error.code;
  return 'UNKNOWN';
}
