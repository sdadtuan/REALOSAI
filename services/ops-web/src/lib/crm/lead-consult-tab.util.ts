import type { LeadFunnelSnapshot } from '@/lib/api';

export const LEAD_CONSULT_TAB_HASH = '#funnel-presales';

/** PO Q1 — tab Tư vấn khi presales exists && stage ∈ {consult, proposal}. */
export function showLeadConsultTab(funnel: LeadFunnelSnapshot | null | undefined): boolean {
  const stage = funnel?.presales?.presales.stage;
  if (!funnel?.presales || !stage) return false;
  return stage === 'consult' || stage === 'proposal';
}

export function presalesStageLabel(stage: string | undefined): string {
  if (stage === 'consult') return 'Tư vấn';
  if (stage === 'proposal') return 'Báo giá';
  if (stage === 'lead') return 'Pre-sales Lead';
  return stage ?? '—';
}
