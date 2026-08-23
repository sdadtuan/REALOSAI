'use client';

import { useEffect, useState } from 'react';
import { fetchBdsWarRoom } from './api';

export type LaunchWarRoomData = Awaited<ReturnType<typeof fetchBdsWarRoom>>;

const POLL_MS = 3000;
const TICK_MS = 1000;

export function useLaunchWarRoom(
  token: string | null,
  launchId: string | null,
  enabled: boolean,
): { data: LaunchWarRoomData | null; error: string; tick: Date } {
  const [data, setData] = useState<LaunchWarRoomData | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick(new Date()), TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled]);

  useEffect(() => {
    if (!token || !launchId || !enabled) {
      setData(null);
      setError('');
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchBdsWarRoom(token, launchId);
        if (!cancelled) {
          setData(next);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Tải war-room thất bại');
        }
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, launchId, enabled]);

  return { data, error, tick };
}
