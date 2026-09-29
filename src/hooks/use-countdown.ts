'use client';

import { useEffect, useEffectEvent, useState } from 'react';

/**
 * Seconds left until `expiresAt`, ticking every 250 ms.
 *
 * `serverNow` is the server clock when the page was rendered: the offset
 * between it and the browser clock is applied so a wrong phone clock cannot
 * give a student extra (or less) time. `onExpire` fires once at zero.
 */
export function useCountdown(expiresAt: string, serverNow: string, onExpire?: () => void): number {
  const deadline = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((deadline - new Date(serverNow).getTime()) / 1000)));
  const expire = useEffectEvent(() => onExpire?.());

  useEffect(() => {
    const offset = new Date(serverNow).getTime() - Date.now();
    let fired = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000));
      setRemaining(left);
      if (left === 0 && !fired) {
        fired = true;
        expire();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [deadline, serverNow]);

  return remaining;
}
