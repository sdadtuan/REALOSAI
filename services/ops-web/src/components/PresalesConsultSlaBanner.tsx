'use client';

import type { PresalesConsultProposalSla } from '@/lib/api';

interface Props {
  sla: PresalesConsultProposalSla;
  disabled?: boolean;
  busy?: boolean;
  onReminder?: () => void;
}

const TONE: Record<string, { bg: string; border: string; title: string }> = {
  ok: { bg: '#f0fdf4', border: '#86efac', title: '#166534' },
  warning: { bg: '#fffbeb', border: '#fcd34d', title: '#b45309' },
  breach: { bg: '#fef2f2', border: '#fca5a5', title: '#b91c1c' },
  na: { bg: '#f8fafc', border: '#cbd5e1', title: '#475569' },
};

export function PresalesConsultSlaBanner({ sla, disabled = false, busy = false, onReminder }: Props) {
  if (sla.sla_state === 'na') return null;

  const tone = TONE[sla.sla_state] ?? TONE.na;
  const showReminder = sla.sla_state === 'warning' || sla.sla_state === 'breach';

  return (
    <section
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 8,
        padding: '0.65rem 0.75rem',
        background: tone.bg,
        marginBottom: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <strong style={{ color: tone.title, fontSize: '0.92rem' }}>
            SLA Consult → Báo giá ≤48h
          </strong>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>{sla.message}</p>
          {sla.deadline_at ? (
            <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.78rem' }}>
              Hạn: {new Date(sla.deadline_at).toLocaleString('vi-VN')}
            </p>
          ) : null}
        </div>
        {showReminder && onReminder ? (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={disabled || busy}
            onClick={onReminder}
          >
            {busy ? 'Đang tạo…' : sla.reminder_cta}
          </button>
        ) : null}
      </div>
    </section>
  );
}
