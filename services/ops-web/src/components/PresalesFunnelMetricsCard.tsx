'use client';

import type { PresalesFunnelMetricsResponse } from '@/lib/api';

interface Props {
  data: PresalesFunnelMetricsResponse;
}

export function PresalesFunnelMetricsCard({ data }: Props) {
  const m = data.metrics;
  const labels = data.labels;

  return (
    <section
      style={{
        border: '1px solid var(--border, #cbd5e1)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        background: '#fff',
        marginBottom: '1rem',
      }}
    >
      <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>Metrics funnel pre-sales</h3>
      <p className="muted" style={{ margin: '0 0 0.75rem', fontSize: '0.82rem' }}>
        {labels.consult_to_proposal_7d}
      </p>
      <p className="muted" style={{ margin: '0 0 0.75rem', fontSize: '0.82rem' }}>
        {labels.consult_to_proposal_48h}
      </p>
      <p className="muted" style={{ margin: '0 0 0.75rem', fontSize: '0.82rem' }}>
        {labels.go_to_handoff}
      </p>
      <p className="muted" style={{ margin: '0 0 0.75rem', fontSize: '0.82rem' }}>
        {labels.handoff_to_release}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
          gap: '0.75rem',
          fontSize: '0.88rem',
        }}
      >
        <div>
          <div className="muted">Go → Consult median</div>
          <strong>
            {m.go_to_consult_median_hours != null ? `${m.go_to_consult_median_hours}h` : '—'}
          </strong>
          <div className="muted" style={{ fontSize: '0.78rem' }}>
            n={m.go_to_consult_sample}
          </div>
        </div>
        <div>
          <div className="muted">Go → Handoff median</div>
          <strong>
            {m.go_to_handoff_median_hours != null ? `${m.go_to_handoff_median_hours}h` : '—'}
          </strong>
          <div className="muted" style={{ fontSize: '0.78rem' }}>
            n={m.go_to_handoff_sample}
          </div>
        </div>
        <div>
          <div className="muted">Handoff → Release median</div>
          <strong>
            {m.handoff_to_release_median_hours != null
              ? `${m.handoff_to_release_median_hours}h`
              : '—'}
          </strong>
          <div className="muted" style={{ fontSize: '0.78rem' }}>
            n={m.handoff_to_release_sample}
          </div>
        </div>
        <div>
          <div className="muted">Consult → BG ≤7d (agency)</div>
          <strong>
            {m.consult_to_proposal_7d_pct}% ({m.consult_to_proposal_7d_num}/{m.consult_to_proposal_7d_denom})
          </strong>
        </div>
        <div>
          <div className="muted">Consult → BG ≤48h (SLA)</div>
          <strong>
            {m.consult_to_proposal_48h_pct}% ({m.consult_to_proposal_48h_num}/{m.consult_to_proposal_48h_denom})
          </strong>
        </div>
        <div>
          <div className="muted">Form Consult</div>
          <strong>{m.consult_form_completion_pct}%</strong>
        </div>
        <div>
          <div className="muted">Task Consult ✓</div>
          <strong>
            {m.consult_task_done_rate}% ({m.consult_tasks_done}/{m.consult_tasks_total})
          </strong>
        </div>
      </div>
    </section>
  );
}
