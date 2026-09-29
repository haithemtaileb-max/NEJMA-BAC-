import 'server-only';

import { DataError, type DataErrorCode } from '@/server/data';

/** What Server Actions return to client components: data, or an error code to translate. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: DataErrorCode };

export async function toActionResult<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (error instanceof DataError) return { ok: false, error: error.code };
    console.error('[action]', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
