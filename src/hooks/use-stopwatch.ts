'use client';

import { useEffect, useState } from 'react';

/**
 * Seconds elapsed while `running` is true. Pausing keeps the value (for the
 * end-of-set summary); changing `resetKey` starts again from zero.
 */
export function useStopwatch(running: boolean, resetKey: unknown = 0): number {
  const [elapsed, setElapsed] = useState(0);
  const [key, setKey] = useState(resetKey);

  // Reset during render when the key changes (no extra effect pass).
  if (key !== resetKey) {
    setKey(resetKey);
    setElapsed(0);
  }

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [running, resetKey]);

  return elapsed;
}
