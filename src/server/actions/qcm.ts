'use server';

import { z } from 'zod';

import { getRepository } from '@/server/data';
import { OPTION_LABELS, type AnswerFeedback } from '@/types/domain';

import { toActionResult, type ActionResult } from './action-result';

const labels = z.array(z.enum(OPTION_LABELS)).min(1).max(OPTION_LABELS.length);
const qcmId = z.uuid();

export async function answerQcmAction(id: string, selected: string[], timeMs: number | null): Promise<ActionResult<AnswerFeedback>> {
  const parsed = z.tuple([qcmId, labels, z.number().int().nonnegative().nullable()]).safeParse([id, selected, timeMs]);
  if (!parsed.success) return { ok: false, error: 'INVALID_SELECTION' };
  const [validId, validLabels, validTime] = parsed.data;
  return toActionResult(() => getRepository().answerQuestion(validId, validLabels, validTime));
}

export async function setBookmarkAction(id: string, bookmarked: boolean): Promise<ActionResult<null>> {
  const parsed = z.tuple([qcmId, z.boolean()]).safeParse([id, bookmarked]);
  if (!parsed.success) return { ok: false, error: 'UNKNOWN' };
  return toActionResult(async () => {
    await getRepository().setBookmark(...parsed.data);
    return null;
  });
}

const reportSchema = z.object({
  qcmId,
  reason: z.enum(['wrong_answer', 'ambiguous', 'typo', 'outdated', 'other']),
  message: z.string().trim().max(1000).transform((m) => m || null),
});

export async function reportQcmAction(input: z.input<typeof reportSchema>): Promise<ActionResult<null>> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'UNKNOWN' };
  const { qcmId: id, reason, message } = parsed.data;
  return toActionResult(async () => {
    await getRepository().reportQuestion(id, reason, message);
    return null;
  });
}
