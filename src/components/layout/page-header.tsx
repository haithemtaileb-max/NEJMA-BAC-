import { ArrowLeft } from 'lucide-react';

import { Link } from '@/i18n/navigation';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, back, icon, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 space-y-3">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {icon}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
          </div>
        </div>
        {actions}
      </div>
    </div>
  );
}
