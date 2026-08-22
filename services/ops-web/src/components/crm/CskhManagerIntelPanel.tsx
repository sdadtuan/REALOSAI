'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { fetchCskhManagerIntelligence, type CskhManagerIntelligence } from '@/lib/api';

interface Props {
  token: string;
  canAssign: boolean;
  onApplyTriage?: (input: {
    leadIds: number[];
    toUserId: number;
    reason: string;
  }) => void;
}

export function CskhManagerIntelPanel({ token, canAssign, onApplyTriage }: Props) {
  const [intel, setIntel] = useState<CskhManagerIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchCskhManagerIntelligence(token);
      setIntel(out);
    } catch (err) {
      setIntel(null);
      setError(err instanceof Error ? err.message : 'Không tải manager intelligence');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <section className="cskh-manager-intel cskh-manager-intel--loading">
        <p className="muted">Đang tải manager intelligence…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="cskh-manager-intel">
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!intel) return null;

  return (
    <section className="cskh-manager-intel" aria-label="Manager intelligence">
      <header className="cskh-manager-intel__head">
        <div>
          <h2 className="cskh-manager-intel__title">Manager intelligence</h2>
          <p className="muted cskh-manager-intel__sub">
            Rep score · triage breach · top SLA breach
            {intel.team_ai_acceptance_pct != null
              ? ` · AI acceptance ${intel.team_ai_acceptance_pct}%`
              : ''}
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void reload()}>
          Làm mới
        </button>
      </header>

      {intel.top_breaches.length > 0 ? (
        <div className="cskh-manager-intel__block">
          <h3>Top breach (ưu tiên sáng)</h3>
          <ul className="cskh-manager-intel__breach-list">
            {intel.top_breaches.map((row) => (
              <li key={row.lead_id}>
                <Link href={`/crm/leads/${row.lead_id}`}>
                  #{row.lead_id} {row.full_name || '—'}
                </Link>
                <span className="muted">
                  {' '}
                  · {row.tier_label} · {row.root_cause_label}
                  {row.owner_name ? ` · ${row.owner_name}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {intel.rep_performance.length > 0 ? (
        <div className="cskh-manager-intel__block">
          <h3>Rep performance (SLA weighted)</h3>
          <div className="data-table-wrap">
            <table className="data-table cskh-manager-intel__rep-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>CSKH</th>
                  <th>Score</th>
                  <th>15p</th>
                  <th>4h</th>
                  <th>24h</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {intel.rep_performance.slice(0, 10).map((rep) => (
                  <tr key={rep.owner_id}>
                    <td>{rep.rank}</td>
                    <td>{rep.owner_name}</td>
                    <td>
                      <span
                        className={`cskh-rep-score${
                          rep.performance_score < 60
                            ? ' cskh-rep-score--low'
                            : rep.performance_score >= 80
                              ? ' cskh-rep-score--high'
                              : ''
                        }`}
                      >
                        {rep.performance_score}
                      </span>
                    </td>
                    <td>{rep.breach_first_call}</td>
                    <td>{rep.breach_b2}</td>
                    <td>{rep.breach_close}</td>
                    <td>{rep.active_leads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {canAssign && intel.triage_suggestions.length > 0 ? (
        <div className="cskh-manager-intel__block">
          <h3>Triage reassign (breach 15p lặp)</h3>
          <ul className="cskh-manager-intel__triage-list">
            {intel.triage_suggestions.map((t) => (
              <li key={t.from_owner_id} className="cskh-manager-intel__triage-item">
                <p>{t.reason}</p>
                <p className="muted">
                  Lead: {t.lead_ids.map((id) => `#${id}`).join(', ')}
                  {t.suggested_to_owner_name ? ` → gợi ý ${t.suggested_to_owner_name}` : ''}
                </p>
                {t.suggested_to_owner_id && onApplyTriage ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() =>
                      onApplyTriage({
                        leadIds: t.lead_ids,
                        toUserId: t.suggested_to_owner_id!,
                        reason: `Triage SLA 15p: chuyển từ ${t.from_owner_name}`,
                      })
                    }
                  >
                    Prefill bulk assign ({t.lead_ids.length})
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {intel.sla_daily_digest.email_preview ? (
        <details className="cskh-manager-intel__digest-preview">
          <summary>SLA daily digest preview (8h)</summary>
          <pre>{intel.sla_daily_digest.email_preview}</pre>
        </details>
      ) : null}
    </section>
  );
}
