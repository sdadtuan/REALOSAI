'use client';

import Link from 'next/link';
import { INTAKE_DECISION_OPTIONS } from '@/lib/crm/intake-labels';
import type { FunnelGateStripViewModel } from '@/lib/crm/funnel-stepper.types';

interface Props {
  leadId: number;
  gateStrip: FunnelGateStripViewModel;
  loading?: boolean;
  onRefresh?: () => void;
}

function decisionLabel(value: string | undefined): string {
  if (!value) return '—';
  return INTAKE_DECISION_OPTIONS.find((d) => d.value === value)?.label ?? value;
}

export function CrmFunnelStepGateStrip({ leadId, gateStrip, loading, onRefresh }: Props) {
  const tone = gateStrip.tone;
  const isProposal = gateStrip.gateKind === 'proposal';

  return (
    <section
      className={`intake-gate-banner intake-gate-banner--${tone} crm-funnel-stepper__gate`}
      aria-live="polite"
      aria-label={
        isProposal ? 'Cổng chuyển Báo giá (G4)' : 'Cổng chuyển Tư vấn "Consult gate"'
      }
    >
      <div className="intake-gate-banner__head">
        <strong>{gateStrip.title}</strong>
        {onRefresh ? (
          <div className="intake-gate-banner__actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={loading}
              onClick={onRefresh}
            >
              {loading ? 'Đang tải…' : 'Làm mới'}
            </button>
          </div>
        ) : null}
      </div>
      {gateStrip.messages.length > 0 ? (
        <ul className="intake-gate-banner__messages">
          {gateStrip.messages.map((m) => (
            <li key={m}>
              {m.includes('task Lead') ? (
                <>
                  {m} — mở{' '}
                  <Link href={`/crm/leads/${leadId}#funnel-presales`} className="nav-link">
                    Lead #{leadId}
                  </Link>{' '}
                  → Pre-sales → tick ✓ task giai đoạn Lead, hoặc bấm <strong>Làm mới</strong> sau khi
                  Intake Go đã hoàn thành.
                </>
              ) : m.includes('Consult') || m.includes('KH MKT') || m.includes('kế hoạch') ? (
                <>
                  {m}
                  {gateStrip.scrollAnchor ? (
                    <>
                      {' '}
                      —{' '}
                      <a href={gateStrip.scrollAnchor} className="nav-link">
                        Điền form bên dưới ↓
                      </a>
                    </>
                  ) : null}
                </>
              ) : (
                m
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {gateStrip.bantTotal != null || gateStrip.decision ? (
        <p className="muted intake-gate-banner__meta">
          BANT {gateStrip.bantTotal ?? '—'}/30 · Quyết định: {decisionLabel(gateStrip.decision)}
          {gateStrip.requiresOverride ? ' · Cần Director override' : ''}
          {gateStrip.requiresConfirm ? ' · Cần xác nhận' : ''}
        </p>
      ) : null}
    </section>
  );
}
