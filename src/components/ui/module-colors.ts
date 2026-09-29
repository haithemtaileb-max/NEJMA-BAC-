import type { ModuleColor } from '@/types/domain';

/**
 * Full class strings per module accent (Tailwind only generates classes it can
 * find verbatim in the source, so no `bg-${color}-500` interpolation).
 */
export const MODULE_COLOR_CLASSES: Record<ModuleColor, { soft: string; bar: string }> = {
  rose: { soft: 'bg-rose-500/10 text-rose-600 dark:text-rose-300', bar: 'bg-rose-500' },
  orange: { soft: 'bg-orange-500/10 text-orange-600 dark:text-orange-300', bar: 'bg-orange-500' },
  amber: { soft: 'bg-amber-500/10 text-amber-600 dark:text-amber-300', bar: 'bg-amber-500' },
  lime: { soft: 'bg-lime-500/10 text-lime-700 dark:text-lime-300', bar: 'bg-lime-500' },
  emerald: { soft: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', bar: 'bg-emerald-500' },
  teal: { soft: 'bg-teal-500/10 text-teal-600 dark:text-teal-300', bar: 'bg-teal-500' },
  cyan: { soft: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300', bar: 'bg-cyan-500' },
  sky: { soft: 'bg-sky-500/10 text-sky-600 dark:text-sky-300', bar: 'bg-sky-500' },
  indigo: { soft: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300', bar: 'bg-indigo-500' },
  violet: { soft: 'bg-violet-500/10 text-violet-600 dark:text-violet-300', bar: 'bg-violet-500' },
  fuchsia: { soft: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300', bar: 'bg-fuchsia-500' },
  slate: { soft: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', bar: 'bg-slate-500' },
};
