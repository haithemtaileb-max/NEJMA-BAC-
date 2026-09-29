import { Slot } from './slot';
import { cn } from '@/lib/utils/cn';

const VARIANTS = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm',
  secondary: 'bg-card text-foreground border border-border hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  danger: 'bg-danger text-white hover:opacity-90',
} as const;

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-9 w-9',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Render the single child (e.g. a Link) with button styles instead of a <button>. */
  asChild?: boolean;
}

export function buttonClasses(variant: keyof typeof VARIANTS = 'primary', size: keyof typeof SIZES = 'md', className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-xl font-medium transition',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({ variant, size, asChild, className, type = 'button', ...props }: ButtonProps) {
  if (asChild) return <Slot className={buttonClasses(variant, size, className)} {...props} />;
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}
