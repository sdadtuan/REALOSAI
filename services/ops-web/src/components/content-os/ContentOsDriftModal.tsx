'use client';

import { useEffect, useState } from 'react';
import {
  fetchPlanSnapshotDriftDiff,
  postPlanSnapshotIngest,
  type ContentOsDriftDiff,
} from '@/lib/content-os-api';

interface Props {
  open: boolean;
  token: string;
  lifecycleId: number;
  marketingPlanId?: number | null;
  canWrite: boolean;
  busy?: boolean;
  onClose: () => void;
  onReingested: () => Promise<void> | void;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}

function DiffSection({
  title,
  added,
  removed,
  changed,
  formatAdded,
}: {
  title: string;
  added: Array<{ name?: string; title?: string; goal?: string; date?: string; channel?: string }>;
  removed: Array<{ name?: string; title?: string }>;
  changed: Array<{ name?: string; title?: string; field: string; before: string; after: string }>;
  formatAdded: (row: { name?: string; title?: string; goal?: string; date?: string; channel?: string }) => string;
}) {
  if (!added.length && !removed.length && !changed.length) {
    return (
      <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
        {title}: không có thay đổi
      </p>
    );
  }
  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      <strong style={{ fontSize: '0.9rem' }}>{title}</strong>
      {added.length ? (
        <div style={{ fontSize: '0.82rem' }}>
          <span style={{ color: 'var(--accent)' }}>+ Thêm ({added.length})</span>
          <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
            {added.map((row, idx) => (
              <li key={`a-${idx}`}>{formatAdded(row)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {removed.length ? (
        <div style={{ fontSize: '0.82rem' }}>
          <span style={{ color: 'var(--danger, #e05555)' }}>− Bỏ ({removed.length})</span>
          <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
            {(removed as Array<{ name?: string; title?: string }>).map((row, idx) => (
              <li key={`r-${idx}`}>{row.name ?? row.title ?? '—'}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {changed.length ? (
        <div style={{ fontSize: '0.82rem' }}>
          <span>~ Đổi ({changed.length})</span>
          <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
            {(changed as Array<{ name?: string; title?: string; field: string; before: string; after: string }>).map(
              (row, idx) => (
                <li key={`c-${idx}`}>
                  {row.name ?? row.title}: {row.field} «{row.before}» → «{row.after}»
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ContentOsDriftModal({
  open,
  token,
  lifecycleId,
  marketingPlanId,
  canWrite,
  busy = false,
  onClose,
  onReingested,
  onMessage,
  onError,
}: Props) {
  const [diff, setDiff] = useState<ContentOsDriftDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [reingesting, setReingesting] = useState(false);

  useEffect(() => {
    if (!open) {
      setDiff(null);
      return;
    }
    setLoading(true);
    onError('');
    void fetchPlanSnapshotDriftDiff(token, lifecycleId)
      .then(setDiff)
      .catch((err) => onError(err instanceof Error ? err.message : 'Tải drift diff thất bại'))
      .finally(() => setLoading(false));
  }, [open, token, lifecycleId, onError]);

  if (!open) return null;

  async function onReimport() {
    if (!canWrite || !diff?.can_reingest) return;
    setReingesting(true);
    onError('');
    try {
      const out = await postPlanSnapshotIngest(token, lifecycleId, {
        marketing_plan_id: marketingPlanId ?? undefined,
        mode: 'merge',
        import_calendar: true,
        import_pillars: true,
      });
      onMessage(
        `Re-import OK — ${out.ideas_created} ideas, ${out.pillars_upserted} pillars`,
      );
      await onReingested();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Re-import thất bại');
    } finally {
      setReingesting(false);
    }
  }

  const disabled = busy || loading || reingesting;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cmkt-drift-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !disabled) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: 'min(640px, 100%)',
          maxHeight: 'min(85vh, 640px)',
          overflow: 'auto',
          padding: '1.25rem',
          display: 'grid',
          gap: '0.85rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="cmkt-drift-modal-title" style={{ margin: 0, fontSize: '1.05rem' }}>
          Planner drift — diff pillars & calendar
        </h3>

        {loading ? <p className="muted">Đang tải diff…</p> : null}

        {diff && !loading ? (
          <>
            {!diff.drift ? (
              <p className="muted" style={{ margin: 0 }}>
                Snapshot khớp Planner hiện tại.
              </p>
            ) : (
              <>
                <DiffSection
                  title="Pillars"
                  added={diff.pillars.added}
                  removed={diff.pillars.removed}
                  changed={diff.pillars.changed}
                  formatAdded={(row) => `${row.name ?? '—'} (${row.goal ?? '—'})`}
                />
                <DiffSection
                  title="Calendar"
                  added={diff.calendar.added}
                  removed={diff.calendar.removed}
                  changed={diff.calendar.changed}
                  formatAdded={(row) =>
                    `${row.date || '—'} · ${row.title ?? '—'} · ${row.channel || '—'}`
                  }
                />
              </>
            )}
          </>
        ) : null}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm btn-ghost" disabled={disabled} onClick={onClose}>
            Đóng
          </button>
          {canWrite && diff?.can_reingest && diff.drift ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={disabled}
              onClick={() => void onReimport()}
            >
              {reingesting ? 'Đang re-import…' : 'Re-import merge'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
