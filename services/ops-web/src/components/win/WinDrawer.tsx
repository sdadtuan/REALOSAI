'use client';

import { useEffect, useId, useRef } from 'react';

type WinDrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function WinDrawer({ open, title, onClose, children, footer }: WinDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="win-drawer-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        className="win-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="win-drawer__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>
        <div className="win-drawer__body">{children}</div>
        {footer ? <div className="win-drawer__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
