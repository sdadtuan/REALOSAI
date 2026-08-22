import type { CskhBoardRow } from './cskh-board.types';
import {
  CSKH_SLA_TIER_LABELS,
  summarizeSlaTiers,
  type CskhSlaTier,
} from './cskh-board-sla.util';
import {
  buildBreachBacklogSnapshot,
  resolveCskhShift,
  type BreachBacklogSnapshot,
  type CskhShiftWindow,
} from './cskh-breach-backlog.util';
import { buildTopBreachSnapshots } from './cskh-manager-intelligence.util';
import type { ReviewQueueMetrics } from '../leads-funnel/review-queue-metrics.util';

export interface ShiftHandoffTopBreachLead {
  id: number;
  name: string;
  tier: CskhSlaTier;
  owner_name: string;
}

export interface ShiftHandoffReport {
  ok: true;
  shift: CskhShiftWindow;
  generated_at: string;
  breach_backlog: BreachBacklogSnapshot;
  open_leads_by_tier: Record<CskhSlaTier, number>;
  review_queue_pending: number;
  review_queue_max_age_hours: number | null;
  top_breach_leads: ShiftHandoffTopBreachLead[];
  handoff_notes: string;
}

export function formatHandoffMarkdown(input: {
  shift: CskhShiftWindow;
  generatedAt: string;
  breachBacklog: BreachBacklogSnapshot;
  openLeadsByTier: Record<CskhSlaTier, number>;
  reviewQueuePending: number;
  reviewQueueMaxAgeHours: number | null;
  topBreachLeads: ShiftHandoffTopBreachLead[];
}): string {
  const lines: string[] = [
    `## CSKH handoff — ${input.shift.shift_label} (hết ca ${input.shift.shift_end_ict} ICT)`,
    `Generated: ${input.generatedAt.slice(0, 16).replace('T', ' ')} UTC`,
    '',
    '### Breach backlog',
    `- Unique breach leads: **${input.breachBacklog.unique_breach_leads}** (target ${input.breachBacklog.target})`,
    `- Gate: ${input.breachBacklog.gate_pass ? 'PASS' : 'FAIL — cần xử lý trước hết ca'}`,
    `- Tier breach: 15p ${input.breachBacklog.tier_breach_counts.first_call_15m} · 4h ${input.breachBacklog.tier_breach_counts.b2_complete_4h} · 24h ${input.breachBacklog.tier_breach_counts.close_24h}`,
    '',
    '### Open SLA cohort',
    `- 15p active: ${input.openLeadsByTier.first_call_15m}`,
    `- 4h active: ${input.openLeadsByTier.b2_complete_4h}`,
    `- 24h active: ${input.openLeadsByTier.close_24h}`,
    '',
    '### Review queue',
    `- Pending: **${input.reviewQueuePending}** lead`,
    input.reviewQueueMaxAgeHours != null
      ? `- Max age: ${input.reviewQueueMaxAgeHours}h`
      : '- Max age: —',
  ];

  if (input.topBreachLeads.length) {
    lines.push('', '### Top breach (ưu tiên xử lý)');
    for (const lead of input.topBreachLeads) {
      lines.push(
        `- #${lead.id} ${lead.name || '—'} — ${CSKH_SLA_TIER_LABELS[lead.tier]} · owner ${lead.owner_name || 'chưa gán'}`,
      );
    }
  } else {
    lines.push('', '### Top breach', '- Không có breach đang mở.');
  }

  lines.push('', '---', 'BR-AI-01: handoff nội bộ — không auto-send khách.');
  return lines.join('\n');
}

export function buildShiftHandoffReport(input: {
  rows: CskhBoardRow[];
  reviewMetrics: ReviewQueueMetrics;
  now?: Date;
}): ShiftHandoffReport {
  const now = input.now ?? new Date();
  const shift = resolveCskhShift(now);
  const breach_backlog = buildBreachBacklogSnapshot(input.rows, now);
  const tierCounts = summarizeSlaTiers(input.rows.map((row) => row.sla_tiers));
  const open_leads_by_tier: Record<CskhSlaTier, number> = {
    first_call_15m: tierCounts.first_call_15m.active,
    b2_complete_4h: tierCounts.b2_complete_4h.active,
    close_24h: tierCounts.close_24h.active,
  };

  const top_breach_leads: ShiftHandoffTopBreachLead[] = buildTopBreachSnapshots(input.rows, 5).map(
    (snap) => ({
      id: snap.lead_id,
      name: snap.full_name,
      tier: snap.worst_tier,
      owner_name: snap.owner_name ?? 'chưa gán',
    }),
  );

  const generated_at = now.toISOString();
  const handoff_notes = formatHandoffMarkdown({
    shift,
    generatedAt: generated_at,
    breachBacklog: breach_backlog,
    openLeadsByTier: open_leads_by_tier,
    reviewQueuePending: input.reviewMetrics.queue_count,
    reviewQueueMaxAgeHours: input.reviewMetrics.max_hours,
    topBreachLeads: top_breach_leads,
  });

  return {
    ok: true,
    shift,
    generated_at,
    breach_backlog,
    open_leads_by_tier,
    review_queue_pending: input.reviewMetrics.queue_count,
    review_queue_max_age_hours: input.reviewMetrics.max_hours,
    top_breach_leads,
    handoff_notes,
  };
}
