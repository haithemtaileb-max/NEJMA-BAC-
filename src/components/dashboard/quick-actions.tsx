import { Box, FileText, Layers, Timer } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';

const ACTIONS = [
  { key: 'exam', href: '/exam', icon: Timer, ready: true },
  { key: 'anatomy', href: '/anatomy', icon: Box, ready: true },
  { key: 'flashcards', href: null, icon: Layers, ready: false },
  { key: 'summaries', href: null, icon: FileText, ready: false },
] as const;

export async function QuickActions() {
  const t = await getTranslations();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ACTIONS.map(({ key, href, icon: Icon, ready }) => {
        const body = (
          <>
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', ready ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-medium">
                {t(`dashboard.actions.${key}`)}
                {!ready && <Badge>{t('common.comingSoon')}</Badge>}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{t(`dashboard.actions.${key}Hint`)}</span>
            </span>
          </>
        );
        const className = 'flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition';
        return href ? (
          <Link key={key} href={href} className={cn(className, 'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md')}>
            {body}
          </Link>
        ) : (
          <div key={key} className={cn(className, 'opacity-70')} aria-disabled="true">
            {body}
          </div>
        );
      })}
    </div>
  );
}
