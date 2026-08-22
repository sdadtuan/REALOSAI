import type { Pool } from 'pg';
import {
  computePresalesFunnelMetrics,
  PRESALES_FUNNEL_METRIC_LABELS,
  type PresalesFunnelMetricsInput,
  type PresalesFunnelMetricsResult,
} from './presales-funnel-metrics.util';

export interface PresalesFunnelMetricsQuery {
  periodStart?: string | null;
  periodEnd?: string | null;
  amId?: number | null;
}

export interface PresalesFunnelMetricsPayload {
  period_start: string | null;
  period_end: string | null;
  am_id: number | null;
  metrics: PresalesFunnelMetricsResult;
  labels: typeof PRESALES_FUNNEL_METRIC_LABELS;
}

function parseJsonArray(raw: unknown): Array<{ key?: string }> {
  if (Array.isArray(raw)) return raw as Array<{ key?: string }>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as Array<{ key?: string }>) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseFormData(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw || '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function buildPeriodClause(
  column: string,
  params: unknown[],
  periodStart?: string | null,
  periodEnd?: string | null,
): string {
  let clause = '';
  if (periodStart) {
    params.push(periodStart);
    clause += ` AND ${column} >= $${params.length}::timestamptz`;
  }
  if (periodEnd) {
    params.push(periodEnd);
    clause += ` AND ${column} < ($${params.length}::date + interval '1 day')`;
  }
  return clause;
}

export async function loadPresalesFunnelMetricsPg(
  db: Pool,
  query: PresalesFunnelMetricsQuery,
): Promise<PresalesFunnelMetricsPayload> {
  const params: unknown[] = [];
  let amFilter = '';
  if (query.amId != null && Number.isFinite(query.amId) && query.amId > 0) {
    params.push(query.amId);
    amFilter = ` AND COALESCE(ps.assigned_am, l.owner_id) = $${params.length}`;
  }

  const goParams = [...params];
  const goPeriod = buildPeriodClause('ps.consult_entered_at', goParams, query.periodStart, query.periodEnd);
  const goResult = await db.query(
    `SELECT s.completed_at AS intake_go_completed_at, ps.consult_entered_at
     FROM crm_lead_presales ps
     INNER JOIN crm_leads l ON l.id = ps.lead_id
     INNER JOIN LATERAL (
       SELECT completed_at FROM crm_lead_intake_sessions i
       WHERE i.lead_id = ps.lead_id
         AND i.status = 'completed'
         AND i.decision = 'go'
         AND i.completed_at IS NOT NULL
         AND i.completed_at::text != ''
       ORDER BY i.completed_at ASC
       LIMIT 1
     ) s ON TRUE
     WHERE ps.consult_entered_at IS NOT NULL
       AND ps.consult_entered_at::text != ''${amFilter}${goPeriod}`,
    goParams,
  );

  const handoffParams = [...params];
  const handoffPeriod = buildPeriodClause(
    'ps.handed_off_at',
    handoffParams,
    query.periodStart,
    query.periodEnd,
  );
  const handoffResult = await db.query(
    `SELECT s.completed_at AS intake_go_completed_at, ps.handed_off_at
     FROM crm_lead_presales ps
     INNER JOIN crm_leads l ON l.id = ps.lead_id
     INNER JOIN LATERAL (
       SELECT completed_at FROM crm_lead_intake_sessions i
       WHERE i.lead_id = ps.lead_id
         AND i.status = 'completed'
         AND i.decision = 'go'
         AND i.completed_at IS NOT NULL
         AND i.completed_at::text != ''
       ORDER BY i.completed_at ASC
       LIMIT 1
     ) s ON TRUE
     WHERE ps.handed_off_at IS NOT NULL
       AND ps.handed_off_at::text != ''${amFilter}${handoffPeriod}`,
    handoffParams,
  );

  const releaseParams = [...params];
  const releasePeriod = buildPeriodClause(
    'ps.solution_released_at',
    releaseParams,
    query.periodStart,
    query.periodEnd,
  );
  const releaseResult = await db.query(
    `SELECT ps.handed_off_at, ps.solution_released_at
     FROM crm_lead_presales ps
     INNER JOIN crm_leads l ON l.id = ps.lead_id
     WHERE ps.handed_off_at IS NOT NULL
       AND ps.handed_off_at::text != ''
       AND ps.solution_released_at IS NOT NULL
       AND ps.solution_released_at::text != ''${amFilter}${releasePeriod}`,
    releaseParams,
  );

  const cpParams = [...params];
  const cpPeriod = buildPeriodClause(
    'ps.proposal_entered_at',
    cpParams,
    query.periodStart,
    query.periodEnd,
  );
  const cpResult = await db.query(
    `SELECT ps.consult_entered_at, ps.proposal_entered_at
     FROM crm_lead_presales ps
     INNER JOIN crm_leads l ON l.id = ps.lead_id
     WHERE ps.consult_entered_at IS NOT NULL
       AND ps.consult_entered_at::text != ''
       AND ps.proposal_entered_at IS NOT NULL
       AND ps.proposal_entered_at::text != ''${amFilter}${cpPeriod}`,
    cpParams,
  );

  const taskParams = [...params];
  const taskPeriod = buildPeriodClause('ps.consult_entered_at', taskParams, query.periodStart, query.periodEnd);
  const taskResult = await db.query(
    `SELECT t.form_fields, t.form_data, t.is_done
     FROM crm_lead_presales_tasks t
     INNER JOIN crm_lead_presales ps ON ps.id = t.presales_id
     INNER JOIN crm_leads l ON l.id = ps.lead_id
     WHERE t.stage = 'consult'
       AND t.is_custom = FALSE${amFilter}${taskPeriod}`,
    taskParams,
  );

  const input: PresalesFunnelMetricsInput = {
    go_to_consult: goResult.rows.map((row: Record<string, unknown>) => ({
      intake_go_completed_at: String(row.intake_go_completed_at ?? ''),
      consult_entered_at: String(row.consult_entered_at ?? ''),
    })),
    go_to_handoff: handoffResult.rows.map((row: Record<string, unknown>) => ({
      intake_go_completed_at: String(row.intake_go_completed_at ?? ''),
      handed_off_at: String(row.handed_off_at ?? ''),
    })),
    handoff_to_release: releaseResult.rows.map((row: Record<string, unknown>) => ({
      handed_off_at: String(row.handed_off_at ?? ''),
      solution_released_at: String(row.solution_released_at ?? ''),
    })),
    consult_to_proposal: cpResult.rows.map((row: Record<string, unknown>) => ({
      consult_entered_at: String(row.consult_entered_at ?? ''),
      proposal_entered_at: String(row.proposal_entered_at ?? ''),
    })),
    consult_tasks: taskResult.rows.map((row: Record<string, unknown>) => ({
      form_fields: parseJsonArray(row.form_fields),
      form_data: parseFormData(row.form_data),
      is_done: Boolean(row.is_done),
    })),
  };

  return {
    period_start: query.periodStart ?? null,
    period_end: query.periodEnd ?? null,
    am_id: query.amId ?? null,
    metrics: computePresalesFunnelMetrics(input),
    labels: PRESALES_FUNNEL_METRIC_LABELS,
  };
}
