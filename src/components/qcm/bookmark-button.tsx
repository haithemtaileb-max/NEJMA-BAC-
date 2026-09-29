'use client';

import { Bookmark } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useOptimistic, useTransition } from 'react';

import { cn } from '@/lib/utils/cn';
import { setBookmarkAction } from '@/server/actions/qcm';

/** Optimistic bookmark toggle: flips instantly, rolls back if the server refuses. */
export function BookmarkButton({ qcmId, bookmarked, onChange }: { qcmId: string; bookmarked: boolean; onChange: (value: boolean) => void }) {
  const t = useTranslations('qcm');
  const [optimistic, setOptimistic] = useOptimistic(bookmarked);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      const result = await setBookmarkAction(qcmId, next);
      if (result.ok) onChange(next);
    });
  }

  const label = optimistic ? t('unbookmark') : t('bookmark');
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={optimistic}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      <Bookmark className={cn('h-4.5 w-4.5', optimistic && 'fill-warning text-warning')} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </button>
  );
}
