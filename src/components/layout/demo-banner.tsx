import { FlaskConical } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { isDemoMode } from '@/lib/supabase/env';

export async function DemoBanner() {
  if (!isDemoMode) return null;
  const t = await getTranslations('demo');
  return (
    <div className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-1.5 text-center text-xs font-medium text-warning">
      <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {t('banner')}
    </div>
  );
}
