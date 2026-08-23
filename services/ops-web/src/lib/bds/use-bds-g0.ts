'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchBdsG0 } from '@/lib/bds/api';
import type { BdsG0Status } from '@/lib/bds/g0-copy';
import { isBdsUiFeEnabled } from '@/lib/bds/flags';

export function useBdsG0(token: string | null | undefined, enabled = true) {
  const [status, setStatus] = useState<BdsG0Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!token || !enabled || !isBdsUiFeEnabled()) {
      setStatus(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setStatus(await fetchBdsG0(token));
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : 'Không tải G0');
    } finally {
      setLoading(false);
    }
  }, [token, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { status, loading, error, reload };
}
