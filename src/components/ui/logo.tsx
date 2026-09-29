import { cn } from '@/lib/utils/cn';

/** "Nejma" means star: a five-point star in a rounded square. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 whitespace-nowrap font-semibold tracking-tight', className)}>
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true">
          <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9L12 2.5Z" />
        </svg>
      </span>
      <span className={cn(compact && 'hidden md:inline')}>
        Nejma<span className="text-primary"> Med</span>
      </span>
    </span>
  );
}
