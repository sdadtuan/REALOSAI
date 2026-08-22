'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchCskhClosedLoopDashboard,
  fetchCskhPlaybookAbMetrics,
  type CskhClosedLoopDashboard,
  type CskhPlaybookAbMetrics,
} from '@/lib/api';

interface Props {
  token: string;
}

export function CskhClosedLoopPanel({ token }: Props) {
  const [dashboard, setDashboard] = useState<CskhClosedLoopDashboard | null>(null);
  const [playbook, setPlaybook] = useState<CskhPlaybookAbMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dash, ab] = await Promise.all([
        fetchCskhClosedLoopDashboard(token),
        fetchCskhPlaybookAbMetrics(token),
      ]);
      setDashboard(dash);
      setPlaybook(ab);
    } catch (err) {
      setDashboard(null);
      setPlaybook(null);
      setError(err instanceof Error ? err.message : 'Không tải closed-loop dashboard');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <section className="cskh-closed-loop cskh-closed-loop--loading">
        <p className="muted">Đang tải closed-loop & quality…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="cskh-closed-loop">
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!dashboard) return null;

  return (
    <section className="cskh-closed-loop" aria-label="Closed-loop quality">
      <header className="cskh-closed-loop__head">
        <div>
          <h2 className="cskh-closed-loop__title">Closed-loop & quality</h2>
          <p className="muted cskh-closed-loop__sub">
            {dashboard.window_days} ngày · {dashboard.summary.chot_total} chốt · fill VND{' '}
            {dashboard.summary.deal_value_fill_pct}% · QA flagged {dashboard.summary.qa_flagged_pct}%
          </p>
          <p
            className={
              dashboard.summary.vnd_fill_gate_pass === true
                ? 'success cskh-closed-loop__gate'
                : dashboard.summary.vnd_fill_gate_pass === false
                  ? 'warning cskh-closed-loop__gate'
                  : 'muted cskh-closed-loop__gate'
            }
          >
            VND fill gate: target ≥{dashboard.summary.vnd_fill_target_pct ?? 90}% ·{' '}
            {dashboard.summary.vnd_fill_gate_pass === true
              ? 'Đạt'
              : dashboard.summary.vnd_fill_gate_pass === false
                ? 'Chưa đạt'
                : 'Chưa có chốt'}
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void reload()}>
          Làm mới
        </button>
      </header>

      {playbook ? (
        <div className="cskh-closed-loop__block">
          <h3>Playbook A/B (AI script vs SOP)</h3>
          <p className="muted">{playbook.narrative}</p>
          <div className="cskh-closed-loop__ab-grid">
            {(['ai_v1', 'sop', 'unknown'] as const).map((key) => {
              const bucket = playbook[key];
              const label = key === 'ai_v1' ? 'AI script' : key === 'sop' ? 'SOP' : 'Chưa gắn';
              return (
                <div key={key} className="cskh-closed-loop__ab-card">
                  <strong>{label}</strong>
                  <span>{bucket.chot_count} chốt</span>
                  <span>≤24h: {bucket.closed_within_24h_pct}%</span>
                  <span>Fill VND: {bucket.deal_value_fill_pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {dashboard.qa_samples.length > 0 ? (
        <div className="cskh-closed-loop__block">
          <h3>QA sample (cần review)</h3>
          <ul className="cskh-closed-loop__qa-list">
            {dashboard.qa_samples.map((row) => (
              <li key={row.lead_id}>
                <Link href={`/crm/leads/${row.lead_id}`}>
                  #{row.lead_id} {row.full_name}
                </Link>
                <span className="muted">
                  {row.owner_name ?? '—'} · {row.qa_flags.map((f) => dashboard.qa_flag_labels?.[f] ?? f).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">Không có lead chốt bị QA flag trong cửa sổ {dashboard.window_days} ngày.</p>
      )}
    </section>
  );
}
