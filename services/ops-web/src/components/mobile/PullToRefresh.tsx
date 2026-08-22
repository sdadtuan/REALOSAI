'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';

interface Props {
  onRefresh: () => Promise<void> | void;
  disabled?: boolean;
  children: ReactNode;
}

const THRESHOLD_PX = 72;

/**
 * RNOS-41.2 / MOB P2 — pull-to-refresh for mobile lead list (network-first).
 */
export function PullToRefresh({ onRefresh, disabled = false, children }: Props) {
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);

  const reset = useCallback(() => {
    startY.current = null;
    pulling.current = false;
    setPullPx(0);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || refreshing) return;
      if (typeof window !== 'undefined' && window.scrollY > 4) return;
      startY.current = e.touches[0]?.clientY ?? null;
      pulling.current = startY.current != null;
    },
    [disabled, refreshing],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || startY.current == null || disabled || refreshing) return;
      const delta = (e.touches[0]?.clientY ?? startY.current) - startY.current;
      if (delta > 0) {
        setPullPx(Math.min(delta, THRESHOLD_PX + 24));
      }
    },
    [disabled, refreshing],
  );

  const onTouchEnd = useCallback(() => {
    if (!pulling.current || disabled || refreshing) {
      reset();
      return;
    }
    if (pullPx >= THRESHOLD_PX) {
      setRefreshing(true);
      void Promise.resolve(onRefresh()).finally(() => {
        setRefreshing(false);
        reset();
      });
      return;
    }
    reset();
  }, [disabled, onRefresh, pullPx, refreshing, reset]);

  const label =
    refreshing ? 'Đang làm mới…' : pullPx >= THRESHOLD_PX ? 'Thả để làm mới' : 'Kéo xuống để làm mới';

  return (
    <div
      className="lead-list-pull-refresh"
      data-testid="lead-list-pull-refresh"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={reset}
    >
      <div
        className={`lead-list-pull-refresh__indicator${pullPx > 8 || refreshing ? ' is-visible' : ''}`}
        style={{ height: refreshing ? THRESHOLD_PX : pullPx }}
        aria-live="polite"
      >
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}
