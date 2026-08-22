'use client';

import { INSIGHT_GATE_COPY } from '@/lib/market-research-api';

export function InsightGateDialog({
  open,
  messages,
  onClose,
}: {
  open: boolean;
  messages: string[];
  onClose: () => void;
}) {
  if (!open) return null;
  const lines = (messages.length ? messages : ['insight_gate']).map(
    (code) => INSIGHT_GATE_COPY[code] ?? code,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Không duyệt được"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 28, 20, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(420px, 92vw)', padding: '1rem' }}
      >
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Không duyệt được</h2>
        <p className="muted" style={{ margin: '0 0 0.5rem' }}>
          Hệ thống chặn vì:
        </p>
        <ul style={{ margin: '0 0 0.9rem', paddingLeft: '1.1rem' }}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  );
}
