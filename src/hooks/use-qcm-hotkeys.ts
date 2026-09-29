'use client';

import { useEffect, useEffectEvent } from 'react';

import { OPTION_LABELS, type OptionLabel } from '@/types/domain';

interface Handlers {
  onOption?: (label: OptionLabel) => void;
  onEnter?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

/**
 * Keyboard shortcuts for answering fast: A–H toggle an option, Enter
 * validates, ←/→ navigate. Ignored while typing in a field or a dialog is open.
 */
export function useQcmHotkeys(handlers: Handlers, enabled = true): void {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (target?.closest('input, textarea, select, [contenteditable="true"], dialog[open]')) return;

    const key = event.key.toUpperCase();
    if ((OPTION_LABELS as readonly string[]).includes(key)) {
      handlers.onOption?.(key as OptionLabel);
    } else if (event.key === 'Enter' && handlers.onEnter) {
      // Don't double-fire when a focused button already handles Enter.
      if (target?.tagName === 'BUTTON') return;
      handlers.onEnter();
    } else if (event.key === 'ArrowRight') {
      handlers.onNext?.();
    } else if (event.key === 'ArrowLeft') {
      handlers.onPrev?.();
    } else {
      return;
    }
    event.preventDefault();
  });

  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => handle(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [enabled]);
}
