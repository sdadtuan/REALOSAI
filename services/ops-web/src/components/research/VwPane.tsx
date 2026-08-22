'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  createResearchVanWestendorp,
  fetchResearchVanWestendorp,
  ResearchApiError,
  TRANSITION_REASON_VI,
  type ResearchVwSummaryRow,
} from '@/lib/market-research-api';
import { formatVwPoint, VW_TAB_BANNER } from '@/components/research/vw-pane.util';

const PCT_COLS = [
  { key: 'too_cheap' as const, label: 'Quá rẻ %' },
  { key: 'cheap' as const, label: 'Rẻ %' },
  { key: 'expensive' as const, label: 'Đắt %' },
  { key: 'too_expensive' as const, label: 'Quá đắt %' },
];

const POINT_ROWS = [
  { key: 'pmc' as const, label: 'PMC' },
  { key: 'pme' as const, label: 'PME' },
  { key: 'opp' as const, label: 'OPP' },
  { key: 'idp' as const, label: 'IDP' },
];

function formatPct(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function VwPane({
  projectId,
  canEdit,
}: {
  projectId: number;
  canEdit: boolean;
}) {
  const [summary, setSummary] = useState<ResearchVwSummaryRow | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const out = await fetchResearchVanWestendorp(token, projectId);
    setSummary(out.summary);
  }, [projectId]);

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : 'Tải bảng giá thất bại');
    });
  }, [load]);

  async function onCompute() {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await createResearchVanWestendorp(token, projectId, {});
      await load();
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      if (api?.code && TRANSITION_REASON_VI[api.code]) {
        setError(TRANSITION_REASON_VI[api.code]);
      } else {
        setError(err instanceof Error ? err.message : 'Tính Van Westendorp thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card stack-gap" style={{ padding: '0.9rem' }}>
      <h2 style={{ margin: 0, fontSize: '1rem' }}>Giá VW</h2>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        {VW_TAB_BANNER}
      </p>
      {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
      {canEdit ? (
        <button type="button" className="btn btn-sm" disabled={saving} onClick={() => void onCompute()}>
          Tính Van Westendorp
        </button>
      ) : null}
      {!summary ? (
        <p className="muted">Chưa có bảng Van Westendorp.</p>
      ) : (
        <>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            n={summary.n} · {summary.unit}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.4rem' }}>Giá</th>
                  {PCT_COLS.map((col) => (
                    <th key={col.key} style={{ textAlign: 'left', padding: '0.4rem' }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.bins.map((bin) => (
                  <tr key={bin.price}>
                    <td style={{ padding: '0.4rem' }}>{bin.price}</td>
                    {PCT_COLS.map((col) => (
                      <td key={col.key} style={{ padding: '0.4rem' }}>
                        {formatPct(bin[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.4rem' }}>Điểm</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem' }}>Giá</th>
                </tr>
              </thead>
              <tbody>
                {POINT_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td style={{ padding: '0.4rem' }}>{row.label}</td>
                    <td style={{ padding: '0.4rem' }}>{formatVwPoint(summary.points[row.key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary.limitation_note ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              {summary.limitation_note}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
