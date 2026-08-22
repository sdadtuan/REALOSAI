'use client';

import { useRef, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  className?: string;
  testId?: string;
}

const SWIPE_THRESHOLD = 56;

/**
 * RNOS-M2 P2 — optional horizontal swipe hint on portal approval cards.
 */
export function PortalSwipeActions({
  children,
  onSwipeLeft,
  onSwipeRight,
  className = '',
  testId = 'portal-approval-swipe-card',
}: Props) {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  function reset() {
    startX.current = null;
    dragging.current = false;
    setOffsetX(0);
  }

  return (
    <div
      className={`portal-approval-swipe ${className}`.trim()}
      data-testid={testId}
      onTouchStart={(e) => {
        startX.current = e.touches[0]?.clientX ?? null;
        dragging.current = startX.current != null;
      }}
      onTouchMove={(e) => {
        if (!dragging.current || startX.current == null) return;
        const delta = (e.touches[0]?.clientX ?? startX.current) - startX.current;
        setOffsetX(Math.max(-96, Math.min(96, delta)));
      }}
      onTouchEnd={() => {
        if (offsetX <= -SWIPE_THRESHOLD && onSwipeLeft) {
          onSwipeLeft();
        } else if (offsetX >= SWIPE_THRESHOLD && onSwipeRight) {
          onSwipeRight();
        }
        reset();
      }}
      onTouchCancel={reset}
    >
      <div className="portal-approval-swipe__track" style={{ transform: `translateX(${offsetX}px)` }}>
        {children}
      </div>
      <div className="portal-approval-swipe__hint muted" aria-hidden="true">
        ← Vuốt để thao tác nhanh
      </div>
    </div>
  );
}
