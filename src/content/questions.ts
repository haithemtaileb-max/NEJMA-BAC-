/**
 * Every starter question: hand-written samples + imported UMMTO banks.
 *   SEED_QCMS       → supabase/seed.sql (published and drafts)
 *   PUBLISHED_QCMS  → what students see (demo mode, tests)
 */
import { IMPORTED_QCMS } from './imported';
import { SAMPLE_QCMS, type SampleQcm } from './sample-qcms';

export type { SampleQcm } from './sample-qcms';

export const SEED_QCMS: readonly SampleQcm[] = [...SAMPLE_QCMS, ...IMPORTED_QCMS];

export const PUBLISHED_QCMS: readonly SampleQcm[] = SEED_QCMS.filter((q) => q.status === 'published');
