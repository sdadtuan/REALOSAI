'use client';

import { KpiTileGrid, type KpiTileProps } from '@/components/kpi/KpiDashboardUi';
import type { KpiSolutionDashboard } from '@/lib/api';

export function KpiSlaTileGrid({ data }: { data: KpiSolutionDashboard | null }) {
  if (!data) return null;

  const m = data.funnel.metrics;
  const sla = data.sla;
  const tiles: KpiTileProps[] = [
    {
      label: 'Queue chờ nhận',
      value: String(data.queue.pending),
      hint: `${data.queue.total} case trong queue`,
      tone: data.queue.pending > 5 ? 'warning' : 'default',
    },
    {
      label: 'Solution đang xử lý',
      value: String(data.queue.with_solution),
      tone: data.queue.with_solution > 8 ? 'warning' : 'default',
    },
    {
      label: 'Consult SLA breach',
      value: String(sla.sla_breach),
      hint: `${sla.sla_ok} OK · ${sla.sla_warning} cảnh báo`,
      tone: sla.sla_breach > 0 ? 'critical' : 'success',
    },
    {
      label: 'Handoff → Release median',
      value: m.handoff_to_release_median_hours != null ? `${m.handoff_to_release_median_hours}h` : '—',
      hint: `n=${m.handoff_to_release_sample}`,
    },
    {
      label: 'Consult → BG ≤48h',
      value: `${sla.consult_to_proposal_48h_pct}%`,
      hint: `${sla.consult_to_proposal_48h_num}/${sla.consult_to_proposal_48h_denom}`,
      tone: sla.consult_to_proposal_48h_pct >= 50 ? 'success' : 'warning',
    },
    {
      label: 'Form Consult hoàn thành',
      value: `${m.consult_form_completion_pct}%`,
      tone: m.consult_form_completion_pct >= 80 ? 'success' : 'warning',
    },
  ];

  return <KpiTileGrid tiles={tiles} />;
}
