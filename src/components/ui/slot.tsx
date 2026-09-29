import { cloneElement, isValidElement } from 'react';

import { cn } from '@/lib/utils/cn';

/** Merge className/props onto the only child element (minimal Radix-style Slot). */
export function Slot({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
  if (!isValidElement<{ className?: string }>(children)) return null;
  return cloneElement(children, { ...props, className: cn(className, children.props.className) });
}
