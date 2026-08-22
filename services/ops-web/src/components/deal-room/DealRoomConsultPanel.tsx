'use client';

import Link from 'next/link';

interface Props {
  done: number;
  total: number;
  leadId: number;
}

export function DealRoomConsultPanel({ done, total, leadId }: Props) {
  const complete = total === 0 || done >= total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section className="deal-room-panel" aria-label="Consult progress">
      <div className="deal-room-panel__head">
        <h3 className="deal-room-panel__title">Consult</h3>
        <span className={`deal-room-badge ${complete ? 'deal-room-badge--ok' : 'deal-room-badge--warn'}`}>
          {done}/{total || '—'} task
        </span>
      </div>
      {total > 0 ? (
        <div className="deal-room-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="deal-room-progress__bar" style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Không có task Consult trên workflow này.
        </p>
      )}
      <Link
        href={`/crm/leads/${leadId}#funnel-presales`}
        className="btn btn-sm btn-secondary"
        style={{ marginTop: '0.75rem' }}
      >
        Mở task Consult →
      </Link>
    </section>
  );
}
