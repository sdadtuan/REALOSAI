'use client';

import type { PresalesConsultSlaSummary } from '@/lib/api';

interface Props {
  summary: PresalesConsultSlaSummary;
}

export function PresalesConsultSlaSummaryCard({ summary }: Props) {
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
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>SLA Consult → Báo giá (48h)</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))',
          gap: '0.75rem',
          fontSize: '0.88rem',
        }}
      >
        <div>
          <div className="muted">Đang Consult</div>
          <strong>{summary.active_consult}</strong>
        </div>
        <div>
          <div className="muted">OK</div>
          <strong style={{ color: '#166534' }}>{summary.sla_ok}</strong>
        </div>
        <div>
          <div className="muted">Sắp hết hạn</div>
          <strong style={{ color: '#b45309' }}>{summary.sla_warning}</strong>
        </div>
        <div>
          <div className="muted">Quá hạn</div>
          <strong style={{ color: '#b91c1c' }}>{summary.sla_breach}</strong>
        </div>
        <div>
          <div className="muted">Chuyển BG ≤48h</div>
          <strong>
            {summary.consult_to_proposal_48h_pct}% ({summary.consult_to_proposal_48h_num}/
            {summary.consult_to_proposal_48h_denom})
          </strong>
        </div>
      </div>
    </section>
  );
}
