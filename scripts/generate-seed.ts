/**
 * Writes supabase/seed.sql from the starter content in src/content.
 *   npm run db:seed:generate
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildSeedSql } from './build-seed-sql';

const target = fileURLToPath(new URL('../supabase/seed.sql', import.meta.url));
writeFileSync(target, buildSeedSql());
console.log(`✓ wrote ${target}`);
