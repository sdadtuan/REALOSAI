'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { fetchCskhBreachBacklog, type CskhBreachBacklogSnapshot } from '@/lib/api';

interface Props {
  token: string;
}

export function CskhBreachBacklogPanel({ token }: Props) {
  const [snapshot, setSnapshot] = useState<CskhBreachBacklogSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchCskhBreachBacklog(token);
      setSnapshot(out);
    } catch (err) {
      setSnapshot(null);
      setError(err instanceof Error ? err.message : 'Không tải breach backlog');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <section className="cskh-breach-backlog cskh-breach-backlog--loading">
        <p className="muted">Đang tải breach backlog cuối ca…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="cskh-breach-backlog">
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!snapshot) return null;

  const tone = snapshot.gate_pass ? 'banner-success' : 'banner-warning';

  return (
    <section
      className={`cskh-breach-backlog banner ${tone}`}
      aria-label="Breach backlog cuối ca"
      data-testid="cskh-breach-backlog-panel"
    >
      <div className="cskh-breach-backlog__head">
        <div>
          <strong>Breach backlog cuối ca</strong>
          <p className="muted cskh-breach-backlog__sub">
            {snapshot.shift.shift_label} · hết ca {snapshot.shift.shift_end_ict} ICT · target{' '}
            {snapshot.target} lead
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void reload()}>
          Làm mới
        </button>
      </div>
      <div className="cskh-breach-backlog__metrics">
        <span className={`cskh-breach-backlog__count${snapshot.gate_pass ? ' success' : ' error'}`}>
          {snapshot.backlog_count} lead breach (unique)
        </span>
        <span className={snapshot.gate_pass ? 'success' : 'warning'}>
          {snapshot.gate_pass ? 'Đạt gate cuối ca' : 'Chưa đạt — cần xử lý trước hết ca'}
        </span>
      </div>
      <p className="muted cskh-breach-backlog__tiers">
        Tier breach: 15p {snapshot.tier_breach_counts.first_call_15m} · 4h{' '}
        {snapshot.tier_breach_counts.b2_complete_4h} · 24h {snapshot.tier_breach_counts.close_24h}
      </p>
      {!snapshot.gate_pass ? (
        <Link href="/crm/cskh-board?sla_filter=breach" className="nav-link">
          Mở board breach →
        </Link>
      ) : null}
    </section>
  );
}
