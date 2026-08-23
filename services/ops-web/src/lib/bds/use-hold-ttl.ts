'use client';

import { useEffect, useState } from 'react';
import { formatHoldTtlRemaining } from './pwa-hold-copy';

export function useHoldTtlTick(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useHoldTtlLabel(expiresAt: string | null | undefined, now?: Date): string {
  const tick = useHoldTtlTick();
  return formatHoldTtlRemaining(expiresAt, now ?? tick);
}
