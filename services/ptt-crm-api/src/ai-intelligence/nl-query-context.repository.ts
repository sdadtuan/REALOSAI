import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  getAttributionDrillPaths,
  getExecutiveWeeklyTrends,
} from '../finance/business-dashboard.util';
import { getMarketingSpendVnd, tableExists, todayYmd } from '../finance/finance-metrics.util';
import { DealScoreContextRepository } from './deal-score-context.repository';
import { NlQueryExecutionResult } from './nl-query.types';
import { RenewalContractContextRepository } from './renewal-contract-context.repository';

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgoYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatYmd(d);
}

function metaLeadFilterSql(): string {
  return `(
    lower(trim(COALESCE(utm_campaign, ''))) != ''
    OR lower(trim(COALESCE(json_extract(meta_json, '$.campaign_id'), ''))) != ''
    OR lower(trim(COALESCE(json_extract(meta_json, '$.facebook_campaign_id'), ''))) != ''
    OR lower(trim(COALESCE(json_extract(meta_json, '$.utm_source'), ''))) LIKE '%meta%'
    OR lower(trim(COALESCE(json_extract(meta_json, '$.utm_source'), ''))) LIKE '%facebook%'
  )`;
}

function channelExprSql(): string {
  return `COALESCE(
    NULLIF(trim(json_extract(meta_json, '$.channel')), ''),
    NULLIF(trim(json_extract(meta_json, '$.utm_source')), ''),
    'unknown'
  )`;
}

@Injectable()
export class NlQueryContextRepository implements OnModuleDestroy {
  private db: DatabaseSync | null = null;
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly deals: DealScoreContextRepository,
    private readonly renewals: RenewalContractContextRepository,
  ) {}

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  private get pg(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  private get database(): DatabaseSync {
    if (!this.db) {
      this.db = new DatabaseSync(this.config.sqlitePath);
      this.db.exec('PRAGMA foreign_keys = ON');
    }
    return this.db;
  }

  async executeSqliteIntent(intentId: string): Promise<NlQueryExecutionResult> {
    switch (intentId) {
      case 'leads_new_7d':
        return this.countLeads('7 ngày', daysAgoYmd(6), todayYmd());
      case 'leads_new_30d':
        return this.countLeads('30 ngày', daysAgoYmd(29), todayYmd());
      case 'leads_won_30d':
        return this.countLeadsWon();
      case 'leads_by_channel_30d':
        return this.leadsByChannel();
      case 'leads_meta_30d':
        return this.countMetaLeads();
      case 'cpl_meta_t30_overview':
        return this.cplMetaOverview();
      case 'revenue_received_7d':
        return this.sumRevenue('7 ngày', daysAgoYmd(6), todayYmd());
      case 'revenue_received_30d':
        return this.sumRevenue('30 ngày', daysAgoYmd(29), todayYmd());
      case 'revenue_trend_12w':
        return this.executiveTrend('revenue');
      case 'leads_trend_12w':
        return this.executiveTrend('leads');
      case 'campaign_leads_top_month':
        return this.campaignLeadsTopMonth();
      case 'open_deals_count':
        return this.openDealsCount();
      case 'marketing_spend_current_month':
        return this.marketingSpendCurrentMonth();
      case 'duplicate_leads_30d':
        return this.countDuplicateLeads();
      case 'qualified_leads_month':
        return this.countQualifiedLeadsMonth();
      case 'renewal_candidates_90d':
        return this.renewalCandidates();
      case 'attribution_drill_paths':
        return this.attributionDrillPaths();
      case 'revenue_by_week_8w':
        return this.executiveTrend('revenue', 8);
      case 'leads_qualified_30d':
        return this.countLeadsByStatus('qualified');
      case 'leads_conversion_rate_30d':
        return this.leadConversionRate();
      case 'leads_unassigned':
        return this.countLeadsWhere('Lead chưa phân công', `(owner_id IS NULL OR trim(CAST(owner_id AS TEXT)) = '')`);
      case 'leads_stale_7d':
        return this.countLeadsWhere(
          'Lead không cập nhật 7 ngày',
          `lower(COALESCE(status, '')) NOT IN ('won', 'lost', 'closed_won', 'closed_lost')
           AND substr(replace(trim(updated_at), 'T', ' '), 1, 10) <= '${daysAgoYmd(7)}'`,
        );
      case 'ops_deals_stalled_14d':
        return this.stalledDeals();
      case 'ops_payments_overdue':
        return this.overduePayments();
      case 'ops_contracts_expiring_30d':
        return this.renewalCandidates(30);
      case 'cpl_by_client_30d':
      case 'revenue_by_client_30d':
      case 'roas_overview_30d':
      case 'roas_meta_30d':
      case 'roas_zalo_30d':
      case 'marketing_spend_by_channel_30d':
      case 'cpl_trend_12w':
      case 'roas_trend_12w':
        return this.executePerformanceIntent(intentId);
      default:
        return { columns: [], rows: [] };
    }
  }

  private countLeads(periodLabel: string, start: string, end: string): NlQueryExecutionResult {
    const count = this.countLeadsRange(start, end, 'COALESCE(is_duplicate, 0) = 0');
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'count', label: 'Số lead', type: 'number' },
      ],
      rows: [{ period: periodLabel, count }],
    };
  }

  private countLeadsWon(): NlQueryExecutionResult {
    const db = this.database;
    if (!tableExists(db, 'crm_leads')) {
      return {
        columns: [
          { key: 'period', label: 'Kỳ', type: 'string' },
          { key: 'count', label: 'Số lead won', type: 'number' },
        ],
        rows: [{ period: '30 ngày', count: 0 }],
      };
    }
    const start = daysAgoYmd(29);
    const end = todayYmd();
    const row = db
      .prepare(
        `SELECT COUNT(*) AS v FROM crm_leads
         WHERE status = 'won'
           AND substr(replace(trim(updated_at), 'T', ' '), 1, 10) >= ?
           AND substr(replace(trim(updated_at), 'T', ' '), 1, 10) <= ?`,
      )
      .get(start, end) as Record<string, unknown> | undefined;
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'count', label: 'Số lead won', type: 'number' },
      ],
      rows: [{ period: '30 ngày', count: Number(row?.v ?? 0) }],
    };
  }

  private countLeadsRange(start: string, end: string, extraWhere = '1=1'): number {
    const db = this.database;
    if (!tableExists(db, 'crm_leads')) return 0;
    const row = db
      .prepare(
        `SELECT COUNT(*) AS v FROM crm_leads
         WHERE ${extraWhere}
           AND substr(replace(trim(created_at), 'T', ' '), 1, 10) >= ?
           AND substr(replace(trim(created_at), 'T', ' '), 1, 10) <= ?`,
      )
      .get(start, end) as Record<string, unknown> | undefined;
    return Number(row?.v ?? 0);
  }

  private leadsByChannel(): NlQueryExecutionResult {
    const db = this.database;
    if (!tableExists(db, 'crm_leads')) {
      return {
        columns: [
          { key: 'channel', label: 'Kênh', type: 'string' },
          { key: 'lead_count', label: 'Lead', type: 'number' },
        ],
        rows: [],
      };
    }
    const start = daysAgoYmd(29);
    const end = todayYmd();
    const expr = channelExprSql();
    const rows = db
      .prepare(
        `SELECT ${expr} AS channel, COUNT(*) AS lead_count
         FROM crm_leads
         WHERE COALESCE(is_duplicate, 0) = 0
           AND substr(replace(trim(created_at), 'T', ' '), 1, 10) >= ?
           AND substr(replace(trim(created_at), 'T', ' '), 1, 10) <= ?
         GROUP BY channel
         ORDER BY lead_count DESC, channel ASC
         LIMIT 20`,
      )
      .all(start, end) as Array<Record<string, unknown>>;
    return {
      columns: [
        { key: 'channel', label: 'Kênh', type: 'string' },
        { key: 'lead_count', label: 'Lead', type: 'number' },
      ],
      rows: rows.map((row) => ({
        channel: String(row.channel ?? 'unknown'),
        lead_count: Number(row.lead_count ?? 0),
      })),
    };
  }

  private countMetaLeads(): NlQueryExecutionResult {
    const db = this.database;
    if (!tableExists(db, 'crm_leads')) {
      return {
        columns: [
          { key: 'period', label: 'Kỳ', type: 'string' },
          { key: 'count', label: 'Lead Meta', type: 'number' },
        ],
        rows: [{ period: '30 ngày', count: 0 }],
      };
    }
    const start = daysAgoYmd(29);
    const end = todayYmd();
    const row = db
      .prepare(
        `SELECT COUNT(*) AS v FROM crm_leads
         WHERE COALESCE(is_duplicate, 0) = 0
           AND substr(replace(trim(created_at), 'T', ' '), 1, 10) >= ?
           AND substr(replace(trim(created_at), 'T', ' '), 1, 10) <= ?
           AND ${metaLeadFilterSql()}`,
      )
      .get(start, end) as Record<string, unknown> | undefined;
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'count', label: 'Lead Meta', type: 'number' },
      ],
      rows: [{ period: '30 ngày', count: Number(row?.v ?? 0) }],
      drill_href: '/meta/ads-combined',
    };
  }

  private cplMetaOverview(): NlQueryExecutionResult {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const [spend] = getMarketingSpendVnd(this.database, year, month);
    const metaLeads = this.countLeadsRange(
      daysAgoYmd(29),
      todayYmd(),
      `COALESCE(is_duplicate, 0) = 0 AND ${metaLeadFilterSql()}`,
    );
    const cpl = spend > 0 && metaLeads > 0 ? Math.round((spend / metaLeads) * 100) / 100 : null;
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'marketing_spend_vnd', label: 'Chi phí MKT tháng', type: 'currency' },
        { key: 'meta_leads', label: 'Lead Meta 30 ngày', type: 'number' },
        { key: 'cpl_vnd', label: 'CPL ước tính', type: 'currency' },
      ],
      rows: [
        {
          period: 'T-30 / tháng hiện tại',
          marketing_spend_vnd: spend,
          meta_leads: metaLeads,
          cpl_vnd: cpl,
        },
      ],
      drill_href: '/meta/ads-combined',
    };
  }

  private sumRevenue(periodLabel: string, start: string, end: string): NlQueryExecutionResult {
    const db = this.database;
    let amount = 0;
    if (tableExists(db, 'crm_svc_payments')) {
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(amount_vnd), 0) AS v
           FROM crm_svc_payments
           WHERE status = 'received'
             AND received_on >= ?
             AND received_on <= ?`,
        )
        .get(start, end) as Record<string, unknown> | undefined;
      amount = Number(row?.v ?? 0);
    }
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'amount_vnd', label: 'Doanh thu thu về', type: 'currency' },
      ],
      rows: [{ period: periodLabel, amount_vnd: amount }],
      drill_href: '/crm/financials',
    };
  }

  private executiveTrend(kind: 'revenue' | 'leads', weeks = 12): NlQueryExecutionResult {
    const now = new Date();
    const trends = getExecutiveWeeklyTrends(this.database, now.getFullYear(), now.getMonth() + 1);
    const labels = ((trends.labels as string[]) ?? []).slice(-weeks);
    const values =
      kind === 'revenue'
        ? ((trends.revenue_vnd as number[]) ?? []).slice(-weeks)
        : ((trends.leads as number[]) ?? []).slice(-weeks);
    return {
      columns: [
        { key: 'week_label', label: 'Tuần', type: 'string' },
        { key: 'value', label: kind === 'revenue' ? 'Doanh thu ₫' : 'Lead', type: 'number' },
      ],
      rows: labels.map((label, idx) => ({
        week_label: label,
        value: Number(values[idx] ?? 0),
      })),
      chart: {
        type: 'line',
        labels,
        series: [
          {
            key: kind,
            label: kind === 'revenue' ? 'Doanh thu' : 'Lead',
            values: values.map((v) => Number(v ?? 0)),
          },
        ],
      },
      drill_href: '/crm/business-dashboard',
    };
  }

  private campaignLeadsTopMonth(): NlQueryExecutionResult {
    const now = new Date();
    const drill = getAttributionDrillPaths(this.database, now.getFullYear(), now.getMonth() + 1, 10);
    const rows = (drill.rows as Array<Record<string, unknown>>) ?? [];
    return {
      columns: [
        { key: 'campaign_key', label: 'Campaign', type: 'string' },
        { key: 'lead_count', label: 'Lead', type: 'number' },
        { key: 'hub_href', label: 'Hub', type: 'string' },
      ],
      rows: rows.map((row) => ({
        campaign_key: String(row.campaign_key ?? row.campaign_label ?? ''),
        lead_count: Number(row.lead_count ?? 0),
        hub_href: String(row.hub_href ?? ''),
      })),
      drill_href: '/crm/business-dashboard',
    };
  }

  private openDealsCount(): NlQueryExecutionResult {
    const ids = this.deals.listOpenDealIds(5000);
    return {
      columns: [
        { key: 'metric', label: 'Chỉ số', type: 'string' },
        { key: 'count', label: 'Giá trị', type: 'number' },
      ],
      rows: [{ metric: 'Deal đang mở', count: ids.length }],
      drill_href: '/crm/sales',
    };
  }

  private marketingSpendCurrentMonth(): NlQueryExecutionResult {
    const now = new Date();
    const [spend, source] = getMarketingSpendVnd(this.database, now.getFullYear(), now.getMonth() + 1);
    return {
      columns: [
        { key: 'period', label: 'Tháng', type: 'string' },
        { key: 'marketing_spend_vnd', label: 'Chi phí MKT', type: 'currency' },
        { key: 'source', label: 'Nguồn', type: 'string' },
      ],
      rows: [
        {
          period: `${now.getMonth() + 1}/${now.getFullYear()}`,
          marketing_spend_vnd: spend,
          source,
        },
      ],
      drill_href: '/crm/business-dashboard',
    };
  }

  private countDuplicateLeads(): NlQueryExecutionResult {
    const count = this.countLeadsRange(daysAgoYmd(29), todayYmd(), 'COALESCE(is_duplicate, 0) = 1');
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'count', label: 'Lead trùng', type: 'number' },
      ],
      rows: [{ period: '30 ngày', count }],
    };
  }

  private countQualifiedLeadsMonth(): NlQueryExecutionResult {
    const db = this.database;
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let count = 0;
    if (tableExists(db, 'crm_leads')) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS v FROM crm_leads
           WHERE status = 'qualified'
             AND substr(replace(trim(created_at), 'T', ' '), 1, 7) = ?`,
        )
        .get(prefix) as Record<string, unknown> | undefined;
      count = Number(row?.v ?? 0);
    }
    return {
      columns: [
        { key: 'period', label: 'Tháng', type: 'string' },
        { key: 'count', label: 'Lead qualified', type: 'number' },
      ],
      rows: [{ period: prefix, count }],
    };
  }

  private renewalCandidates(days = 90): NlQueryExecutionResult {
    const candidates = this.renewals.listRenewalCandidates(days, 25);
    return {
      columns: [
        { key: 'contract_id', label: 'HĐ', type: 'number' },
        { key: 'client_name', label: 'Client', type: 'string' },
        { key: 'ends_on', label: 'Hết hạn', type: 'string' },
        { key: 'days_until_end', label: 'Còn (ngày)', type: 'number' },
        { key: 'amount_vnd', label: 'Giá trị', type: 'currency' },
      ],
      rows: candidates.map((row) => ({
        contract_id: row.contract_id,
        client_name: row.client_name ?? row.contract_title,
        ends_on: row.ends_on,
        days_until_end: row.days_until_end,
        amount_vnd: row.amount_vnd,
      })),
      drill_href: '/crm/renewals',
    };
  }

  private attributionDrillPaths(): NlQueryExecutionResult {
    const now = new Date();
    const drill = getAttributionDrillPaths(this.database, now.getFullYear(), now.getMonth() + 1, 10);
    const rows = (drill.rows as Array<Record<string, unknown>>) ?? [];
    return {
      columns: [
        { key: 'campaign_key', label: 'Campaign', type: 'string' },
        { key: 'lead_count', label: 'Lead', type: 'number' },
        { key: 'hub_href', label: 'Hub drill', type: 'string' },
        { key: 'lead_href', label: 'Lead mẫu', type: 'string' },
      ],
      rows,
      drill_href: '/crm/business-dashboard',
    };
  }

  private countLeadsByStatus(status: string): NlQueryExecutionResult {
    const count = this.countLeadsRange(
      daysAgoYmd(29),
      todayYmd(),
      `COALESCE(is_duplicate, 0) = 0 AND lower(COALESCE(status, '')) = '${status}'`,
    );
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'count', label: 'Lead', type: 'number' },
      ],
      rows: [{ period: '30 ngày', count }],
    };
  }

  private countLeadsWhere(metric: string, where: string): NlQueryExecutionResult {
    const db = this.database;
    let count = 0;
    if (tableExists(db, 'crm_leads')) {
      const row = db.prepare(`SELECT COUNT(*) AS v FROM crm_leads WHERE ${where}`).get() as
        | Record<string, unknown>
        | undefined;
      count = Number(row?.v ?? 0);
    }
    return {
      columns: [
        { key: 'metric', label: 'Chỉ số', type: 'string' },
        { key: 'count', label: 'Giá trị', type: 'number' },
      ],
      rows: [{ metric, count }],
    };
  }

  private leadConversionRate(): NlQueryExecutionResult {
    const total = this.countLeadsRange(daysAgoYmd(29), todayYmd(), 'COALESCE(is_duplicate, 0) = 0');
    const won = this.countLeadsRange(
      daysAgoYmd(29),
      todayYmd(),
      `COALESCE(is_duplicate, 0) = 0 AND lower(COALESCE(status, '')) IN ('won', 'closed_won')`,
    );
    return {
      columns: [
        { key: 'total', label: 'Lead mới', type: 'number' },
        { key: 'won', label: 'Won', type: 'number' },
        { key: 'conversion_rate_pct', label: 'Tỷ lệ', type: 'pct' },
      ],
      rows: [{ total, won, conversion_rate_pct: total ? Math.round((won / total) * 1000) / 10 : null }],
    };
  }

  private stalledDeals(): NlQueryExecutionResult {
    const db = this.database;
    let count = 0;
    if (tableExists(db, 'crm_cases')) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS v FROM crm_cases
           WHERE lower(COALESCE(status, '')) NOT IN ('closed', 'won', 'lost')
             AND datetime(updated_at) <= datetime('now', '-14 days')`,
        )
        .get() as Record<string, unknown> | undefined;
      count = Number(row?.v ?? 0);
    }
    return {
      columns: [{ key: 'count', label: 'Deal treo >14 ngày', type: 'number' }],
      rows: [{ count }],
      drill_href: '/crm/sales',
    };
  }

  private overduePayments(): NlQueryExecutionResult {
    const db = this.database;
    let count = 0;
    let amount = 0;
    if (tableExists(db, 'crm_svc_payments')) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS count, COALESCE(SUM(amount_vnd), 0) AS amount
           FROM crm_svc_payments
           WHERE status = 'pending' AND due_on < ?`,
        )
        .get(todayYmd()) as Record<string, unknown> | undefined;
      count = Number(row?.count ?? 0);
      amount = Number(row?.amount ?? 0);
    }
    return {
      columns: [
        { key: 'count', label: 'Khoản quá hạn', type: 'number' },
        { key: 'amount_vnd', label: 'Tổng quá hạn', type: 'currency' },
      ],
      rows: [{ count, amount_vnd: amount }],
      drill_href: '/crm/financials',
    };
  }

  private async executePerformanceIntent(intentId: string): Promise<NlQueryExecutionResult> {
    try {
      const channel =
        intentId === 'roas_meta_30d' ? 'meta' : intentId === 'roas_zalo_30d' ? 'zalo' : null;
      if (intentId === 'cpl_trend_12w' || intentId === 'roas_trend_12w') {
        const result = await this.pg.query(
          `SELECT to_char(date_trunc('week', performance_date), 'DD/MM') AS label,
                  SUM(spend)::float8 AS spend,
                  SUM(leads_crm)::float8 AS leads,
                  SUM(conversion_value)::float8 AS revenue
           FROM daily_performance
           WHERE performance_date >= CURRENT_DATE - INTERVAL '12 weeks'
           GROUP BY date_trunc('week', performance_date)
           ORDER BY date_trunc('week', performance_date)`,
        );
        const metric = intentId.startsWith('cpl') ? 'cpl' : 'roas';
        const rows = result.rows.map((row) => ({
          label: String(row.label),
          value:
            metric === 'cpl'
              ? Number(row.leads) > 0
                ? Number(row.spend) / Number(row.leads)
                : 0
              : Number(row.spend) > 0
                ? Number(row.revenue) / Number(row.spend)
                : 0,
        }));
        return {
          columns: [
            { key: 'label', label: 'Tuần', type: 'string' },
            { key: 'value', label: metric.toUpperCase(), type: 'number' },
          ],
          rows,
          chart: {
            type: 'line',
            labels: rows.map((row) => row.label),
            series: [{ key: metric, label: metric.toUpperCase(), values: rows.map((row) => row.value) }],
          },
          drill_href: '/crm/business-dashboard',
        };
      }

      const result = await this.pg.query(
        `SELECT dp.client_id::text, COALESCE(c.name, c.code, dp.client_id::text) AS client_name,
                dp.channel, SUM(dp.spend)::float8 AS spend,
                SUM(dp.leads_crm)::float8 AS leads,
                SUM(dp.conversion_value)::float8 AS revenue
         FROM daily_performance dp
         LEFT JOIN clients c ON c.id = dp.client_id
         WHERE dp.performance_date >= CURRENT_DATE - INTERVAL '29 days'
           AND ($1::text IS NULL OR dp.channel = $1)
         GROUP BY dp.client_id, c.name, c.code, dp.channel
         ORDER BY SUM(dp.spend) DESC`,
        [channel],
      );
      const rows = result.rows.map((row) => ({
        client_id: String(row.client_id),
        client_name: String(row.client_name),
        channel: String(row.channel),
        spend_vnd: Number(row.spend ?? 0),
        leads: Number(row.leads ?? 0),
        revenue_vnd: Number(row.revenue ?? 0),
        cpl_vnd: Number(row.leads) > 0 ? Number(row.spend) / Number(row.leads) : null,
        roas: Number(row.spend) > 0 ? Number(row.revenue) / Number(row.spend) : null,
      }));

      if (intentId === 'marketing_spend_by_channel_30d' || intentId.startsWith('roas_')) {
        const byChannel = new Map<string, { spend: number; revenue: number }>();
        for (const row of rows) {
          const current = byChannel.get(row.channel) ?? { spend: 0, revenue: 0 };
          current.spend += row.spend_vnd;
          current.revenue += row.revenue_vnd;
          byChannel.set(row.channel, current);
        }
        const aggregate = [...byChannel].map(([name, value]) => ({
          channel: name,
          spend_vnd: value.spend,
          roas: value.spend > 0 ? value.revenue / value.spend : null,
        }));
        const key = intentId === 'marketing_spend_by_channel_30d' ? 'spend_vnd' : 'roas';
        return {
          columns: [
            { key: 'channel', label: 'Kênh', type: 'string' },
            { key, label: key === 'roas' ? 'ROAS' : 'Chi phí', type: key === 'roas' ? 'number' : 'currency' },
          ],
          rows: aggregate,
          chart:
            intentId === 'marketing_spend_by_channel_30d'
              ? {
                  type: 'bar',
                  labels: aggregate.map((row) => row.channel),
                  series: [
                    {
                      key,
                      label: 'Chi phí',
                      values: aggregate.map((row) => Number(row.spend_vnd)),
                    },
                  ],
                }
              : undefined,
          drill_href: '/crm/business-dashboard',
        };
      }

      return {
        columns: [
          { key: 'client_name', label: 'Client', type: 'string' },
          {
            key: intentId === 'cpl_by_client_30d' ? 'cpl_vnd' : 'revenue_vnd',
            label: intentId === 'cpl_by_client_30d' ? 'CPL' : 'Doanh thu',
            type: 'currency',
          },
          { key: 'spend_vnd', label: 'Chi phí', type: 'currency' },
          { key: 'leads', label: 'Lead', type: 'number' },
        ],
        rows,
        drill_href: '/crm/business-dashboard',
      };
    } catch {
      return {
        columns: [{ key: 'status', label: 'Trạng thái', type: 'string' }],
        rows: [{ status: 'PG performance chưa sẵn sàng' }],
        drill_href: '/crm/business-dashboard',
      };
    }
  }
}
