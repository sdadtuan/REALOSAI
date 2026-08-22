import { DatabaseSync } from 'node:sqlite';
import { parseYmd, tableExists, todayYmd } from './finance-metrics.util';

export const EXECUTIVE_WEEKLY_DEFAULT = 12;
export const ATTRIBUTION_DRILL_DEFAULT = 5;

export interface ExecutiveWeekBucket {
  start: string;
  end: string;
  label: string;
  revenue_vnd: number;
  leads: number;
}

export interface AttributionDrillRow {
  campaign_key: string;
  campaign_label: string;
  lead_count: number;
  sample_lead_id: number | null;
  sample_lead_name: string | null;
  hub_href: string;
  lead_href: string | null;
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function lastDayOfMonth(year: number, month: number): string {
  return formatYmd(new Date(year, month, 0));
}

export function resolveExecutiveAnchorYmd(year: number, month: number, asOf = todayYmd()): string {
  const monthEnd = lastDayOfMonth(year, month);
  return monthEnd < asOf ? monthEnd : asOf;
}

export function buildExecutiveWeekBuckets(anchorYmd: string, weeks = EXECUTIVE_WEEKLY_DEFAULT): ExecutiveWeekBucket[] {
  const anchor = parseYmd(anchorYmd);
  if (!anchor) return [];

  const anchorDate = new Date(`${anchor}T12:00:00`);
  const count = Math.max(2, Math.min(Math.trunc(weeks), 12));
  const buckets: ExecutiveWeekBucket[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const endDate = new Date(anchorDate);
    endDate.setDate(endDate.getDate() - i * 7);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    const end = formatYmd(endDate);
    const start = formatYmd(startDate);
    buckets.push({
      start,
      end,
      label: `${end.slice(8, 10)}/${end.slice(5, 7)}`,
      revenue_vnd: 0,
      leads: 0,
    });
  }

  return buckets;
}

function sumReceivedRevenue(db: DatabaseSync, start: string, end: string): number {
  if (!tableExists(db, 'crm_svc_payments')) return 0;
  const row = db
    .prepare(
      `
      SELECT COALESCE(SUM(amount_vnd), 0) AS v
      FROM crm_svc_payments
      WHERE status = 'received'
        AND received_on >= ?
        AND received_on <= ?
    `,
    )
    .get(start, end) as Record<string, unknown> | undefined;
  return Number(row?.v ?? 0);
}

function countLeadsCreated(db: DatabaseSync, start: string, end: string): number {
  if (!tableExists(db, 'crm_leads')) return 0;
  const row = db
    .prepare(
      `
      SELECT COUNT(*) AS v
      FROM crm_leads
      WHERE COALESCE(is_duplicate, 0) = 0
        AND substr(replace(trim(created_at), 'T', ' '), 1, 10) >= ?
        AND substr(replace(trim(created_at), 'T', ' '), 1, 10) <= ?
    `,
    )
    .get(start, end) as Record<string, unknown> | undefined;
  return Number(row?.v ?? 0);
}

export function getExecutiveWeeklyTrends(
  db: DatabaseSync,
  year: number,
  month: number,
  weeks = EXECUTIVE_WEEKLY_DEFAULT,
): Record<string, unknown> {
  const anchor = resolveExecutiveAnchorYmd(year, month);
  const buckets = buildExecutiveWeekBuckets(anchor, weeks).map((bucket) => ({
    ...bucket,
    revenue_vnd: sumReceivedRevenue(db, bucket.start, bucket.end),
    leads: countLeadsCreated(db, bucket.start, bucket.end),
  }));

  const labels = buckets.map((b) => b.label);
  return {
    weeks: buckets.length,
    anchor,
    labels,
    revenue_vnd: buckets.map((b) => b.revenue_vnd),
    leads: buckets.map((b) => b.leads),
    buckets,
  };
}

function leadCampaignSql(): string {
  return `COALESCE(
    NULLIF(trim(utm_campaign), ''),
    NULLIF(trim(json_extract(meta_json, '$.campaign_id')), ''),
    NULLIF(trim(json_extract(meta_json, '$.facebook_campaign_id')), ''),
    NULLIF(trim(json_extract(meta_json, '$.utm_campaign')), '')
  )`;
}

export function getAttributionDrillPaths(
  db: DatabaseSync,
  year: number,
  month: number,
  limit = ATTRIBUTION_DRILL_DEFAULT,
): Record<string, unknown> {
  if (!tableExists(db, 'crm_leads')) {
    return { rows: [] as AttributionDrillRow[], count: 0 };
  }

  const monthPrefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  const campaignExpr = leadCampaignSql();
  const maxRows = Math.max(1, Math.min(Math.trunc(limit), 10));

  const rows = db
    .prepare(
      `
      SELECT
        ${campaignExpr} AS campaign_key,
        COUNT(*) AS lead_count,
        MAX(id) AS sample_lead_id
      FROM crm_leads
      WHERE COALESCE(is_duplicate, 0) = 0
        AND substr(replace(trim(created_at), 'T', ' '), 1, 7) = ?
        AND ${campaignExpr} IS NOT NULL
        AND trim(${campaignExpr}) != ''
      GROUP BY campaign_key
      ORDER BY lead_count DESC, campaign_key ASC
      LIMIT ?
    `,
    )
    .all(monthPrefix, maxRows) as Array<Record<string, unknown>>;

  const drillRows: AttributionDrillRow[] = rows.map((row) => {
    const campaignKey = String(row.campaign_key ?? '').trim();
    const sampleLeadId =
      row.sample_lead_id != null && Number.isFinite(Number(row.sample_lead_id))
        ? Number(row.sample_lead_id)
        : null;
    let sampleLeadName: string | null = null;
    if (sampleLeadId != null) {
      const leadRow = db
        .prepare('SELECT full_name FROM crm_leads WHERE id = ? LIMIT 1')
        .get(sampleLeadId) as Record<string, unknown> | undefined;
      sampleLeadName = leadRow?.full_name ? String(leadRow.full_name) : null;
    }
    const hubHref = `/crm/hub?campaign_id=${encodeURIComponent(campaignKey)}`;
    const leadHref = sampleLeadId != null ? `/crm/leads/${sampleLeadId}` : null;
    return {
      campaign_key: campaignKey,
      campaign_label: campaignKey,
      lead_count: Number(row.lead_count ?? 0),
      sample_lead_id: sampleLeadId,
      sample_lead_name: sampleLeadName,
      hub_href: hubHref,
      lead_href: leadHref,
    };
  });

  return {
    year,
    month,
    count: drillRows.length,
    rows: drillRows,
  };
}

export function getBusinessDashboardExecutive(
  db: DatabaseSync,
  year: number,
  month: number,
): Record<string, unknown> {
  return {
    weekly_trends: getExecutiveWeeklyTrends(db, year, month, EXECUTIVE_WEEKLY_DEFAULT),
    attribution_drill: getAttributionDrillPaths(db, year, month, ATTRIBUTION_DRILL_DEFAULT),
  };
}
