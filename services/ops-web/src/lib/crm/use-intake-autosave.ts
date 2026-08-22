'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type IntakeAutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface Options {
  enabled: boolean;
  paused: boolean;
  snapshot: string;
  onSave: () => Promise<void>;
  debounceMs?: number;
}

export function useIntakeAutosave({
  enabled,
  paused,
  snapshot,
  onSave,
  debounceMs = 30_000,
}: Options) {
  const [status, setStatus] = useState<IntakeAutosaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const lastSavedSnapshot = useRef(snapshot);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const onSaveRef = useRef(onSave);

  onSaveRef.current = onSave;

  const dirty = snapshot !== lastSavedSnapshot.current;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runSave = useCallback(async () => {
    if (!enabled || paused || savingRef.current) return;
    if (snapshot === lastSavedSnapshot.current) return;

    savingRef.current = true;
    clearTimer();
    setStatus('saving');
    try {
      await onSaveRef.current();
      lastSavedSnapshot.current = snapshot;
      setSavedAt(new Date());
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      savingRef.current = false;
    }
  }, [clearTimer, enabled, paused, snapshot]);

  useEffect(() => {
    if (!enabled || paused || !dirty) {
      clearTimer();
      return;
    }

    clearTimer();
    setStatus('pending');
    timerRef.current = setTimeout(() => {
      void runSave();
    }, debounceMs);

    return clearTimer;
  }, [clearTimer, debounceMs, dirty, enabled, paused, runSave, snapshot]);

  const saveOnBlur = useCallback(() => {
    if (!enabled || paused || !dirty || savingRef.current) return;
    clearTimer();
    void runSave();
  }, [clearTimer, dirty, enabled, paused, runSave]);

  const syncSnapshot = useCallback((nextSnapshot: string) => {
    lastSavedSnapshot.current = nextSnapshot;
    clearTimer();
    setStatus('idle');
    setSavedAt(null);
  }, [clearTimer]);

  const markSavedNow = useCallback((nextSnapshot: string) => {
    lastSavedSnapshot.current = nextSnapshot;
    setSavedAt(new Date());
    setStatus('saved');
  }, []);

  return {
    status,
    savedAt,
    dirty,
    saveOnBlur,
    syncSnapshot,
    markSavedNow,
  };
}

export function formatIntakeAutosaveTime(date: Date): string {
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
