'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  fetchResearchIsoGap,
  type IsoGapCheckPayload,
} from '@/lib/market-research-api';
import {
  ISO_GAP_BANNER,
  ISO_GAP_PHASE_LABELS,
  ISO_GAP_STATUS_LABELS,
  groupIsoGapItemsByPhase,
  isoGapStatusTone,
  type IsoGapPhase,
} from '@/components/research/iso-gap-panel.util';

type ResearchIsoGapPanelProps = {
  projectId: number;
};

const PHASE_ORDER: IsoGapPhase[] = ['planning', 'execution', 'supervision', 'reporting'];

export function ResearchIsoGapPanel({ projectId }: ResearchIsoGapPanelProps) {
  const [payload, setPayload] = useState<IsoGapCheckPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const out = await fetchResearchIsoGap(token, projectId);
      setPayload(out);
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : 'Không tải được ISO gap-check');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = payload ? groupIsoGapItemsByPhase(payload.items) : null;

  return (
    <section data-testid="iso-gap-panel">
      <p
        className="muted"
        style={{
          margin: '0 0 0.75rem',
          padding: '0.45rem 0.55rem',
          borderRadius: 8,
          fontSize: '0.82rem',
          background: 'rgba(100, 116, 139, 0.12)',
          color: '#334155',
        }}
      >
        {ISO_GAP_BANNER}
      </p>

      {loading ? <p className="muted">Đang tải checklist…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {payload && grouped ? (
        <>
          <p className="muted" style={{ margin: '0 0 0.75rem', fontSize: '0.85rem' }}>
            Product type: <strong>{payload.product_type}</strong> · Đạt {payload.summary.pass} · Một phần{' '}
            {payload.summary.partial} · Thiếu {payload.summary.fail}
          </p>
          {PHASE_ORDER.map((phase) => {
            const rows = grouped[phase];
            if (!rows.length) return null;
            return (
              <div key={phase} style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem' }}>{ISO_GAP_PHASE_LABELS[phase]}</h3>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.35rem' }}>
                  {rows.map((item) => {
                    const tone = isoGapStatusTone(item.status);
                    return (
                      <li
                        key={item.id}
                        data-testid={`iso-gap-item-${item.id}`}
                        style={{
                          display: 'grid',
                          gap: '0.15rem',
                          padding: '0.45rem 0.55rem',
                          borderRadius: 8,
                          background: tone.bg,
                          color: tone.color,
                          fontSize: '0.85rem',
                        }}
                      >
                        <span>
                          <strong>{item.label_vi}</strong> — {ISO_GAP_STATUS_LABELS[item.status]}
                        </span>
                        {item.hint_vi ? <span style={{ opacity: 0.9 }}>{item.hint_vi}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </>
      ) : null}
    </section>
  );
}
