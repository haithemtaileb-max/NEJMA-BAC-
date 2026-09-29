import { LogOut } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { Logo } from '@/components/ui/logo';
import { Link } from '@/i18n/navigation';
import { signOut } from '@/server/actions/auth';

import { LocaleSwitcher } from './locale-switcher';
import { NavLinks } from './nav-links';

export async function AppHeader() {
  const [t, locale] = await Promise.all([getTranslations('nav'), getLocale()]);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/dashboard" className="mr-1 sm:mr-2" aria-label="Nejma Med">
          <Logo compact />
        </Link>
        <NavLinks />
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher />
          <form action={signOut.bind(null, locale)}>
            <button
              type="submit"
              title={t('signOut')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{t('signOut')}</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
