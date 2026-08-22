'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPct } from '@/lib/kpi/format';
import { fetchAiAcceptanceMetrics, fetchAiDismissReasons } from '@/lib/ai-api';

const NBA_ACCEPTANCE_TARGET_PCT = 35;

export function NbaAcceptancePanel({ token, days = 7 }: { token: string; days?: number }) {
  const [acceptancePct, setAcceptancePct] = useState<number | null>(null);
  const [accepted, setAccepted] = useState(0);
  const [resolved, setResolved] = useState(0);
  const [dismissReasons, setDismissReasons] = useState<Array<{ reason: string; count: number }>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    void Promise.all([
      fetchAiAcceptanceMetrics(token, { days, recommendation_type: 'nba' }),
      fetchAiDismissReasons(token, { days, recommendation_type: 'nba' }),
    ])
      .then(([acceptance, dismiss]) => {
        setAcceptancePct(acceptance.data.acceptance_rate_pct);
        setAccepted(acceptance.data.accepted);
        setResolved(acceptance.data.total_resolved);
        setDismissReasons(dismiss.data.top_dismiss_reasons ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Tải NBA acceptance thất bại');
        setAcceptancePct(null);
      })
      .finally(() => setLoading(false));
  }, [token, days]);

  if (loading) return <p className="muted">Đang tải NBA acceptance…</p>;
  if (error) return <p className="error">{error}</p>;

  const gatePass = acceptancePct != null && acceptancePct >= NBA_ACCEPTANCE_TARGET_PCT;

  return (
    <section className="nba-acceptance-panel" data-testid="nba-acceptance-panel">
      <h3 className="kpi-section-title">AI NBA acceptance</h3>
      <div className="nba-acceptance-panel__metric">
        <span className="muted">Chấp nhận NBA (recommendation_type=nba)</span>
        <strong data-testid="nba-acceptance-rate">
          {acceptancePct != null ? formatPct(acceptancePct) : '—'}
          {resolved > 0 ? ` · ${accepted}/${resolved} quyết định` : ''}
        </strong>
        <span className={gatePass ? 'success' : 'warning'}>
          Target ≥{formatPct(NBA_ACCEPTANCE_TARGET_PCT)} · {gatePass ? 'Đạt' : 'Chưa đạt'}
        </span>
      </div>
      {dismissReasons.length > 0 ? (
        <div className="nba-acceptance-panel__dismiss">
          <span className="muted">Top lý do dismiss</span>
          <ul className="nba-acceptance-panel__dismiss-list">
            {dismissReasons.slice(0, 5).map((row) => (
              <li key={row.reason}>
                <code>{row.reason}</code> · {row.count}
              </li>
            ))}
          </ul>
          <Link href="/crm/ai/insights?status=dismissed" className="btn btn-sm btn-ghost">
            Xem inbox dismiss
          </Link>
        </div>
      ) : null}
    </section>
  );
}
