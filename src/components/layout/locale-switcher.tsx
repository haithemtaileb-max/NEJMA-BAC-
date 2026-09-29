'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils/cn';

/** FR | EN toggle that keeps the current page (next-intl also remembers the choice in a cookie). */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: (typeof routing.locales)[number]) {
    // `pathname` has no locale prefix: next-intl rebuilds the URL for the new locale.
    startTransition(() => router.replace(pathname, { locale: next }));
  }

  return (
    <div
      role="group"
      aria-label={t('language')}
      className={cn('inline-flex items-center rounded-xl border border-border bg-card p-0.5 text-xs font-semibold', isPending && 'opacity-60', className)}
    >
      <Languages className="mx-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          aria-pressed={l === locale}
          className={cn(
            'rounded-lg px-2 py-1 uppercase transition',
            l === locale ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
