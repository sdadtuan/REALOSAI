'use client';

import { useMemo, useState } from 'react';
import { putOpsKpi, type OpsHubPayload, type OpsKpiMetric } from '@/lib/ops-dv-api';

const LABEL_STYLE: Record<string, { bg: string; color: string; text: string }> = {
  Dat: { bg: '#e8f5e9', color: '#2e7d32', text: 'Đạt' },
  CanChuY: { bg: '#fff8e1', color: '#f57f17', text: 'Cần chú ý' },
  KhongDat: { bg: '#ffebee', color: '#c62828', text: 'Không đạt' },
};

type Props = {
  token: string;
  lifecycleId: number;
  kpi: OpsHubPayload['kpi'];
  canEdit: boolean;
  onRefresh: () => Promise<void>;
};

export function OpsKpiPanel({ token, lifecycleId, kpi, canEdit, onRefresh }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});

  const metrics = kpi.metrics as OpsKpiMetric[];

  const draftMetrics = useMemo(() => {
    const out: Record<string, { actual?: number | null }> = {};
    for (const m of metrics) {
      const raw = draft[m.key] ?? (m.actual != null ? String(m.actual) : '');
      if (raw.trim() === '') continue;
      const num = Number(raw);
      if (Number.isFinite(num)) out[m.key] = { actual: num };
    }
    return out;
  }, [draft, metrics]);

  async function onSave() {
    if (!canEdit || Object.keys(draftMetrics).length === 0) return;
    setBusy(true);
    setError('');
    try {
      await putOpsKpi(token, lifecycleId, {
        period_type: kpi.period_type,
        period_key: kpi.period_key,
        metrics: draftMetrics,
      });
      setDraft({});
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu KPI thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (metrics.length === 0) {
    return (
      <section>
        <h4 style={{ margin: '0 0 0.5rem' }}>KPI DV ({kpi.period_key})</h4>
        <p className="muted">Chưa có định nghĩa KPI cho DV này.</p>
      </section>
    );
  }

  return (
    <section>
      <h4 style={{ margin: '0 0 0.5rem' }}>
        KPI DV · {kpi.period_type === 'month' ? 'Tháng' : 'Tuần'} {kpi.period_key}
      </h4>
      {error ? <p className="error">{error}</p> : null}
      <div style={{ display: 'grid', gap: '0.65rem' }}>
        {metrics.map((m) => {
          const label = m.status_label ? LABEL_STYLE[m.status_label] : null;
          return (
            <div
              key={m.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                gap: '0.5rem',
                alignItems: 'center',
                padding: '0.5rem 0.65rem',
                border: '1px solid var(--border, #ddd)',
                borderRadius: 6,
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{m.label}</div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  Target: {m.target ?? '—'} {m.unit ?? ''}
                </div>
              </div>
              {canEdit ? (
                <input
                  type="number"
                  step="any"
                  placeholder={m.actual != null ? String(m.actual) : 'Actual'}
                  value={draft[m.key] ?? ''}
                  disabled={busy}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [m.key]: e.target.value }))}
                  style={{ width: 88 }}
                />
              ) : (
                <span>{m.actual ?? '—'}</span>
              )}
              {label ? (
                <span
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: 4,
                    background: label.bg,
                    color: label.color,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label.text}
                </span>
              ) : (
                <span className="muted">—</span>
              )}
            </div>
          );
        })}
      </div>
      {canEdit ? (
        <button
          type="button"
          className="btn btn-sm"
          style={{ marginTop: '0.75rem' }}
          disabled={busy || Object.keys(draftMetrics).length === 0}
          onClick={() => void onSave()}
        >
          Lưu KPI
        </button>
      ) : null}
    </section>
  );
}
