import type { DatabaseSync } from 'node:sqlite';
import {
  computePresalesFunnelMetrics,
  PRESALES_FUNNEL_METRIC_LABELS,
  type PresalesFunnelMetricsInput,
} from './presales-funnel-metrics.util';
import type { PresalesFunnelMetricsPayload, PresalesFunnelMetricsQuery } from './presales-funnel-metrics-load.pg.util';

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
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw || '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function buildSqlitePeriod(column: string, periodStart?: string | null, periodEnd?: string | null): string {
  let clause = '';
  if (periodStart) {
    clause += ` AND datetime(replace(${column}, 'T', ' ')) >= datetime('${periodStart.replace(/'/g, "''")}')`;
  }
  if (periodEnd) {
    clause += ` AND datetime(replace(${column}, 'T', ' ')) < datetime('${periodEnd.replace(/'/g, "''")}', '+1 day')`;
  }
  return clause;
}

export function loadPresalesFunnelMetricsSqlite(
  db: DatabaseSync,
  query: PresalesFunnelMetricsQuery,
): PresalesFunnelMetricsPayload {
  const params: number[] = [];
  let amFilter = '';
  if (query.amId != null && Number.isFinite(query.amId) && query.amId > 0) {
    amFilter = ' AND COALESCE(ps.assigned_am, l.owner_id) = ?';
    params.push(query.amId);
  }

  const goPeriod = buildSqlitePeriod('ps.consult_entered_at', query.periodStart, query.periodEnd);
  const goRows = db
    .prepare(
      `SELECT s.completed_at AS intake_go_completed_at, ps.consult_entered_at
       FROM crm_lead_presales ps
       INNER JOIN crm_leads l ON l.id = ps.lead_id
       INNER JOIN (
         SELECT lead_id, MIN(completed_at) AS completed_at
         FROM crm_lead_intake_sessions
         WHERE status = 'completed' AND decision = 'go'
           AND completed_at != ''
         GROUP BY lead_id
       ) s ON s.lead_id = ps.lead_id
       WHERE ps.consult_entered_at != ''${amFilter}${goPeriod}`,
    )
    .all(...params) as Array<Record<string, unknown>>;

  const handoffPeriod = buildSqlitePeriod('ps.handed_off_at', query.periodStart, query.periodEnd);
  const handoffRows = db
    .prepare(
      `SELECT s.completed_at AS intake_go_completed_at, ps.handed_off_at
       FROM crm_lead_presales ps
       INNER JOIN crm_leads l ON l.id = ps.lead_id
       INNER JOIN (
         SELECT lead_id, MIN(completed_at) AS completed_at
         FROM crm_lead_intake_sessions
         WHERE status = 'completed' AND decision = 'go'
           AND completed_at != ''
         GROUP BY lead_id
       ) s ON s.lead_id = ps.lead_id
       WHERE ps.handed_off_at != ''${amFilter}${handoffPeriod}`,
    )
    .all(...params) as Array<Record<string, unknown>>;

  const releasePeriod = buildSqlitePeriod(
    'ps.solution_released_at',
    query.periodStart,
    query.periodEnd,
  );
  const releaseRows = db
    .prepare(
      `SELECT ps.handed_off_at, ps.solution_released_at
       FROM crm_lead_presales ps
       INNER JOIN crm_leads l ON l.id = ps.lead_id
       WHERE ps.handed_off_at != ''
         AND ps.solution_released_at != ''${amFilter}${releasePeriod}`,
    )
    .all(...params) as Array<Record<string, unknown>>;

  const cpPeriod = buildSqlitePeriod('ps.proposal_entered_at', query.periodStart, query.periodEnd);
  const cpRows = db
    .prepare(
      `SELECT ps.consult_entered_at, ps.proposal_entered_at
       FROM crm_lead_presales ps
       INNER JOIN crm_leads l ON l.id = ps.lead_id
       WHERE ps.consult_entered_at != ''
         AND ps.proposal_entered_at != ''${amFilter}${cpPeriod}`,
    )
    .all(...params) as Array<Record<string, unknown>>;

  const taskPeriod = buildSqlitePeriod('ps.consult_entered_at', query.periodStart, query.periodEnd);
  const taskRows = db
    .prepare(
      `SELECT t.form_fields, t.form_data, t.is_done
       FROM crm_lead_presales_tasks t
       INNER JOIN crm_lead_presales ps ON ps.id = t.presales_id
       INNER JOIN crm_leads l ON l.id = ps.lead_id
       WHERE t.stage = 'consult'
         AND t.is_custom = 0${amFilter}${taskPeriod}`,
    )
    .all(...params) as Array<Record<string, unknown>>;

  const input: PresalesFunnelMetricsInput = {
    go_to_consult: goRows.map((row) => ({
      intake_go_completed_at: String(row.intake_go_completed_at ?? ''),
      consult_entered_at: String(row.consult_entered_at ?? ''),
    })),
    go_to_handoff: handoffRows.map((row) => ({
      intake_go_completed_at: String(row.intake_go_completed_at ?? ''),
      handed_off_at: String(row.handed_off_at ?? ''),
    })),
    handoff_to_release: releaseRows.map((row) => ({
      handed_off_at: String(row.handed_off_at ?? ''),
      solution_released_at: String(row.solution_released_at ?? ''),
    })),
    consult_to_proposal: cpRows.map((row) => ({
      consult_entered_at: String(row.consult_entered_at ?? ''),
      proposal_entered_at: String(row.proposal_entered_at ?? ''),
    })),
    consult_tasks: taskRows.map((row) => ({
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
