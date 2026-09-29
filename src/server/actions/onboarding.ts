'use server';

import { z } from 'zod';

import { redirect } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getRepository } from '@/server/data';
import { MAJORS } from '@/types/domain';

import { toActionResult, type ActionResult } from './action-result';

const schema = z.object({
  locale: z.enum(routing.locales),
  major: z.enum(MAJORS),
  studyYear: z.union([z.literal(1), z.literal(2)]),
});

/** Save the student's major + year, then open their personalised dashboard. */
export async function completeOnboarding(input: z.input<typeof schema>): Promise<ActionResult<never>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'UNKNOWN' };
  const { locale, major, studyYear } = parsed.data;

  const result = await toActionResult(() => getRepository().setCurriculum(major, studyYear));
  if (!result.ok) return result;
  return redirect({ href: '/dashboard', locale });
}
