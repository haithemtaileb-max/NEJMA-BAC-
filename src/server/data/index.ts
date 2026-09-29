import 'server-only';

import { isDemoMode } from '@/lib/supabase/env';

import { demoRepository } from './demo-repository';
import type { Repository } from './repository';
import { supabaseRepository } from './supabase-repository';

/** The active data source: Supabase when configured, bundled demo content otherwise. */
export function getRepository(): Repository {
  return isDemoMode ? demoRepository : supabaseRepository;
}

export { DataError, type DataErrorCode } from './repository';
