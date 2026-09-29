import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { Logo } from '@/components/ui/logo';
import { Link } from '@/i18n/navigation';

export default function AuthLayout({ children }: LayoutProps<'/[locale]'>) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Link href="/">
          <Logo />
        </Link>
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">{children}</main>
    </div>
  );
}
