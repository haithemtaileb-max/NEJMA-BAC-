'use server';

import { z } from 'zod';

import { redirect } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { MAX_DURATION_MINUTES, MIN_DURATION_MINUTES } from '@/lib/qcm/exam-config';
import { getRepository } from '@/server/data';
import { OPTION_LABELS, type ExamResult } from '@/types/domain';

import { toActionResult, type ActionResult } from './action-result';

const startSchema = z.object({
  locale: z.enum(routing.locales),
  moduleIds: z.array(z.uuid()).max(30),
  questionCount: z.number().int().min(1).max(200),
  durationMinutes: z.number().int().min(MIN_DURATION_MINUTES).max(MAX_DURATION_MINUTES),
  scoringMode: z.enum(['all_or_nothing', 'partial']),
});

/** Draw a paper and open the timed session page. */
export async function startExamAction(input: z.input<typeof startSchema>): Promise<ActionResult<never>> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'UNKNOWN' };
  const { locale, durationMinutes, ...rest } = parsed.data;

  const result = await toActionResult(() => getRepository().startExam({ ...rest, durationSeconds: durationMinutes * 60 }));
  if (!result.ok) return result;
  return redirect({ href: `/exam/${result.data}`, locale });
}

const labels = z.array(z.enum(OPTION_LABELS)).max(OPTION_LABELS.length);

export async function saveExamAnswerAction(
  sessionId: string,
  position: number,
  selected: string[],
  flagged: boolean,
): Promise<ActionResult<null>> {
  const parsed = z.tuple([z.uuid(), z.number().int().min(1), labels, z.boolean()]).safeParse([sessionId, position, selected, flagged]);
  if (!parsed.success) return { ok: false, error: 'UNKNOWN' };
  return toActionResult(async () => {
    await getRepository().saveExamAnswer(...parsed.data);
    return null;
  });
}

export async function submitExamAction(sessionId: string, answers: Record<number, string[]>): Promise<ActionResult<ExamResult>> {
  const parsed = z.tuple([z.uuid(), z.record(z.string().regex(/^\d+$/), labels)]).safeParse([sessionId, answers]);
  if (!parsed.success) return { ok: false, error: 'UNKNOWN' };
  const [id, validAnswers] = parsed.data;
  return toActionResult(() => getRepository().submitExam(id, validAnswers));
}
