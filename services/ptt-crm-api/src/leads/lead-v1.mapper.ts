import { LeadRow, LeadV1, PgLeadRow } from './leads.types';
import { formatLeadTs } from './lead-ts.format';
import { reviewQueuePublicState } from '../leads-funnel/review-queue.util';
import { resolveLeadFlowKind } from '../leads-funnel/lead-flow-kind.util';
import {
  computeB2bAiBand,
  computeB2bSlaState,
  isB2bInHoursNow,
  isB2bLeadInCall,
} from '../b2b-projects/b2b-lead-list.util';

function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function metaString(meta: Record<string, unknown>, key: string): string {
  const val = meta[key];
  if (val === undefined || val === null) {
    return '';
  }
  return String(val);
}

function metaNumber(meta: Record<string, unknown>, key: string): number | null {
  const financial =
    typeof meta.financial === 'object' && meta.financial !== null
      ? (meta.financial as Record<string, unknown>)
      : meta;
  const val = financial[key] ?? meta[key];
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function leadFinancialFields(meta: Record<string, unknown>): Pick<LeadV1, 'expected_value' | 'margin_pct'> {
  return {
    expected_value: metaNumber(meta, 'expected_value'),
    margin_pct: metaNumber(meta, 'margin_pct'),
  };
}

/** Mirror ptt_crm/leads_read.py lead_row_to_v1() — contract frozen Step 2. */
export function leadRowToV1(row: LeadRow): LeadV1 {
  const meta = parseMeta(row.meta_json);
  const channel = String(
    metaString(meta, 'channel') ||
      metaString(meta, 'ingest_channel') ||
      metaString(meta, 'utm_source') ||
      row.source ||
      '',
  );
  const campaignRaw = String(
    metaString(meta, 'campaign_id') ||
      metaString(meta, 'facebook_campaign_id') ||
      metaString(meta, 'zalo_campaign_id') ||
      '',
  );
  const externalRaw = String(
    metaString(meta, 'facebook_leadgen_id') ||
      metaString(meta, 'zalo_lead_id') ||
      metaString(meta, 'external_lead_id') ||
      '',
  );
  const agencyClientId = meta.agency_client_id;
  const receivedAt = String(
    metaString(meta, 'ingested_at') ||
      metaString(meta, 'facebook_created_time') ||
      row.created_at ||
      '',
  );

  return {
    id: Number(row.id),
    full_name: row.full_name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    status: row.status ?? '',
    source: row.source ?? '',
    channel,
    client_id:
      agencyClientId !== undefined && agencyClientId !== null ? String(agencyClientId) : null,
    campaign_id: campaignRaw || null,
    external_lead_id: externalRaw || null,
    owner_id: row.owner_id != null ? Number(row.owner_id) : null,
    created_at: row.created_at ?? '',
    received_at: receivedAt,
    is_duplicate: Boolean(row.is_duplicate),
    ...leadFinancialFields(meta),
    review_queue: reviewQueuePublicState(meta, String(metaString(meta, 'assigned_at') || '')),
  };
}

/** Map PG crm_leads read replica row → LeadV1 (Bước 7). */
export function pgRowToV1(row: PgLeadRow): LeadV1 {
  const meta =
    typeof row.meta_json === 'string'
      ? parseMeta(row.meta_json)
      : typeof row.meta_json === 'object' && row.meta_json !== null
        ? (row.meta_json as Record<string, unknown>)
        : {};
  const assignedAt =
    row.first_assigned_at != null
      ? formatLeadTs(row.first_assigned_at)
      : String(metaString(meta, 'assigned_at') || '');

  const flowKind = resolveLeadFlowKind({
    clientId: row.agency_client_id,
    channel: row.channel,
    source: row.source,
    status: row.status,
    metaJson: meta,
  });

  const score =
    row.lead_score != null
      ? Number(row.lead_score)
      : metaNumber(meta, 'lead_score');
  const assignConfidenceRaw = row.assign_confidence ?? metaNumber(meta, 'assign_confidence');

  const b2bExtras =
    row.b2b_project_id || flowKind === 'b2b_prospect'
      ? buildB2bListExtras(row, meta, score)
      : {};

  return {
    id: Number(row.sqlite_lead_id),
    full_name: row.full_name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    status: row.status ?? '',
    source: row.source ?? '',
    channel: row.channel ?? '',
    client_id: row.agency_client_id ? String(row.agency_client_id) : null,
    campaign_id: row.campaign_id || null,
    external_lead_id: row.external_lead_id || null,
    owner_id: row.owner_id != null ? Number(row.owner_id) : null,
    created_at: formatLeadTs(row.created_at),
    received_at: formatLeadTs(row.received_at),
    is_duplicate: Boolean(row.is_duplicate),
    b2b_project_id: row.b2b_project_id ? String(row.b2b_project_id) : null,
    owner_company_id: row.owner_company_id ? String(row.owner_company_id) : null,
    assign_strategy: row.assign_strategy ? String(row.assign_strategy) : null,
    assign_confidence: assignConfidenceRaw,
    lead_flow_kind: flowKind,
    ...b2bExtras,
    ...leadFinancialFields(meta),
    review_queue: reviewQueuePublicState(meta, assignedAt),
  };
}

function buildB2bListExtras(
  row: PgLeadRow,
  meta: Record<string, unknown>,
  score: number | null,
): Pick<LeadV1, 'project_code' | 'ai_band' | 'sla_state' | 'in_call'> {
  const assignedRaw =
    row.b2b_assigned_at ??
    (metaString(meta, 'auto_assigned_at') ? metaString(meta, 'auto_assigned_at') : null) ??
    row.first_assigned_at ??
    row.received_at ??
    row.created_at;
  const assignedDt = assignedRaw ? new Date(String(assignedRaw)) : null;
  const elapsedMin =
    assignedDt && !Number.isNaN(assignedDt.getTime())
      ? Math.max(0, (Date.now() - assignedDt.getTime()) / 60_000)
      : 0;
  const hasCall = Boolean(row.b2b_has_call);
  const answered = Boolean(row.b2b_call_answered ?? metaString(meta, 'b2b_call_answered') === 'true');

  return {
    project_code: row.project_code ? String(row.project_code) : null,
    ai_band: computeB2bAiBand(score),
    sla_state: computeB2bSlaState({
      score,
      elapsedMin,
      hasCallActivity: hasCall,
      answered,
      inHours: isB2bInHoursNow(),
    }),
    in_call: isB2bLeadInCall(row.b2b_call_state ? String(row.b2b_call_state) : null),
  };
}
