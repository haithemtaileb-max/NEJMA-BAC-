import type { LucideProps } from 'lucide-react';

/** Molar icon drawn in the lucide style (lucide has no tooth glyph). */
export function ToothIcon({ size = 24, strokeWidth = 2, className, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M7.5 3C5 3 3.5 5 3.5 7.5c0 2 .7 3.3 1.3 4.8.6 1.6.7 3.4 1 5.2.3 2 1 3.5 2.2 3.5 1.4 0 1.6-2 2-3.8.3-1.3.9-2.2 2-2.2s1.7.9 2 2.2c.4 1.8.6 3.8 2 3.8 1.2 0 1.9-1.5 2.2-3.5.3-1.8.4-3.6 1-5.2.6-1.5 1.3-2.8 1.3-4.8C20.5 5 19 3 16.5 3c-1.9 0-2.8 1-4.5 1S9.4 3 7.5 3Z" />
    </svg>
  );
}
