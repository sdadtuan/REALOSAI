import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  getAttributionDrillPathsPg,
  getExecutiveWeeklyTrendsPg,
  getMarketingSpendVnd,
  sumReceivedRevenueForRange,
  tableExists,
} from '../finance/finance-pg-metrics.util';
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

function todayYmd(): string {
  return formatYmd(new Date());
}

function metaLeadFilterPgSql(): string {
  return `(
    lower(trim(COALESCE(utm_campaign, ''))) != ''
    OR lower(trim(COALESCE(meta_json->>'campaign_id', ''))) != ''
    OR lower(trim(COALESCE(meta_json->>'facebook_campaign_id', ''))) != ''
    OR lower(trim(COALESCE(meta_json->>'utm_source', ''))) LIKE '%meta%'
    OR lower(trim(COALESCE(meta_json->>'utm_source', ''))) LIKE '%facebook%'
  )`;
}

function channelExprPgSql(): string {
  return `COALESCE(
    NULLIF(trim(meta_json->>'channel'), ''),
    NULLIF(trim(meta_json->>'utm_source'), ''),
    'unknown'
  )`;
}

@Injectable()
export class NlQueryContextRepository implements OnModuleDestroy {
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
        return this.countLeadsWhere('Lead chưa phân công', 'owner_id IS NULL');
      case 'leads_stale_7d':
        return this.countLeadsStale7d();
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

  private async countLeads(
    periodLabel: string,
    start: string,
    end: string,
  ): Promise<NlQueryExecutionResult> {
    const count = await this.countLeadsRange(start, end, 'COALESCE(is_duplicate, false) = false');
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'count', label: 'Số lead', type: 'number' },
      ],
      rows: [{ period: periodLabel, count }],
    };
  }

  private async countLeadsWon(): Promise<NlQueryExecutionResult> {
    if (!(await tableExists(this.pg, 'crm_leads'))) {
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
    const result = await this.pg.query(
      `SELECT COUNT(*)::bigint AS v FROM crm_leads
       WHERE status = 'won'
         AND updated_at::date >= $1::date
         AND updated_at::date <= $2::date`,
      [start, end],
    );
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'count', label: 'Số lead won', type: 'number' },
      ],
      rows: [{ period: '30 ngày', count: Number(result.rows[0]?.v ?? 0) }],
    };
  }

  private async countLeadsRange(start: string, end: string, extraWhere = 'TRUE'): Promise<number> {
    if (!(await tableExists(this.pg, 'crm_leads'))) return 0;
    const result = await this.pg.query(
      `SELECT COUNT(*)::bigint AS v FROM crm_leads
       WHERE ${extraWhere}
         AND created_at::date >= $1::date
         AND created_at::date <= $2::date`,
      [start, end],
    );
    return Number(result.rows[0]?.v ?? 0);
  }

  private async leadsByChannel(): Promise<NlQueryExecutionResult> {
    if (!(await tableExists(this.pg, 'crm_leads'))) {
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
    const expr = channelExprPgSql();
    const result = await this.pg.query(
      `SELECT ${expr} AS channel, COUNT(*)::bigint AS lead_count
       FROM crm_leads
       WHERE COALESCE(is_duplicate, false) = false
         AND created_at::date >= $1::date
         AND created_at::date <= $2::date
       GROUP BY channel
       ORDER BY lead_count DESC, channel ASC
       LIMIT 20`,
      [start, end],
    );
    return {
      columns: [
        { key: 'channel', label: 'Kênh', type: 'string' },
        { key: 'lead_count', label: 'Lead', type: 'number' },
      ],
      rows: (result.rows as Array<Record<string, unknown>>).map((row) => ({
        channel: String(row.channel ?? 'unknown'),
        lead_count: Number(row.lead_count ?? 0),
      })),
    };
  }

  private async countMetaLeads(): Promise<NlQueryExecutionResult> {
    const start = daysAgoYmd(29);
    const end = todayYmd();
    const count = await this.countLeadsRange(
      start,
      end,
      `COALESCE(is_duplicate, false) = false AND ${metaLeadFilterPgSql()}`,
    );
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'count', label: 'Lead Meta', type: 'number' },
      ],
      rows: [{ period: '30 ngày', count }],
      drill_href: '/meta/ads-combined',
    };
  }

  private async cplMetaOverview(): Promise<NlQueryExecutionResult> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const [spend] = await getMarketingSpendVnd(this.pg, year, month);
    const metaLeads = await this.countLeadsRange(
      daysAgoYmd(29),
      todayYmd(),
      `COALESCE(is_duplicate, false) = false AND ${metaLeadFilterPgSql()}`,
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

  private async sumRevenue(
    periodLabel: string,
    start: string,
    end: string,
  ): Promise<NlQueryExecutionResult> {
    const amount = await sumReceivedRevenueForRange(this.pg, start, end);
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'amount_vnd', label: 'Doanh thu thu về', type: 'currency' },
      ],
      rows: [{ period: periodLabel, amount_vnd: amount }],
      drill_href: '/crm/financials',
    };
  }

  private async executiveTrend(
    kind: 'revenue' | 'leads',
    weeks = 12,
  ): Promise<NlQueryExecutionResult> {
    const now = new Date();
    const trends = await getExecutiveWeeklyTrendsPg(this.pg, now.getFullYear(), now.getMonth() + 1, weeks);
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

  private async campaignLeadsTopMonth(): Promise<NlQueryExecutionResult> {
    const now = new Date();
    const drill = await getAttributionDrillPathsPg(this.pg, now.getFullYear(), now.getMonth() + 1, 10);
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

  private async openDealsCount(): Promise<NlQueryExecutionResult> {
    const ids = await this.deals.listOpenDealIds(5000);
    return {
      columns: [
        { key: 'metric', label: 'Chỉ số', type: 'string' },
        { key: 'count', label: 'Giá trị', type: 'number' },
      ],
      rows: [{ metric: 'Deal đang mở', count: ids.length }],
      drill_href: '/crm/sales',
    };
  }

  private async marketingSpendCurrentMonth(): Promise<NlQueryExecutionResult> {
    const now = new Date();
    const [spend, source] = await getMarketingSpendVnd(this.pg, now.getFullYear(), now.getMonth() + 1);
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

  private async countDuplicateLeads(): Promise<NlQueryExecutionResult> {
    const count = await this.countLeadsRange(
      daysAgoYmd(29),
      todayYmd(),
      'COALESCE(is_duplicate, false) = true',
    );
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'count', label: 'Lead trùng', type: 'number' },
      ],
      rows: [{ period: '30 ngày', count }],
    };
  }

  private async countQualifiedLeadsMonth(): Promise<NlQueryExecutionResult> {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let count = 0;
    if (await tableExists(this.pg, 'crm_leads')) {
      const result = await this.pg.query(
        `SELECT COUNT(*)::bigint AS v FROM crm_leads
         WHERE status = 'qualified'
           AND to_char(created_at, 'YYYY-MM') = $1`,
        [prefix],
      );
      count = Number(result.rows[0]?.v ?? 0);
    }
    return {
      columns: [
        { key: 'period', label: 'Tháng', type: 'string' },
        { key: 'count', label: 'Lead qualified', type: 'number' },
      ],
      rows: [{ period: prefix, count }],
    };
  }

  private async renewalCandidates(days = 90): Promise<NlQueryExecutionResult> {
    const candidates = await this.renewals.listRenewalCandidates(days, 25);
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

  private async attributionDrillPaths(): Promise<NlQueryExecutionResult> {
    const now = new Date();
    const drill = await getAttributionDrillPathsPg(this.pg, now.getFullYear(), now.getMonth() + 1, 10);
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

  private async countLeadsByStatus(status: string): Promise<NlQueryExecutionResult> {
    const count = await this.countLeadsRange(
      daysAgoYmd(29),
      todayYmd(),
      `COALESCE(is_duplicate, false) = false AND lower(COALESCE(status, '')) = '${status}'`,
    );
    return {
      columns: [
        { key: 'period', label: 'Kỳ', type: 'string' },
        { key: 'count', label: 'Lead', type: 'number' },
      ],
      rows: [{ period: '30 ngày', count }],
    };
  }

  private async countLeadsWhere(metric: string, where: string): Promise<NlQueryExecutionResult> {
    let count = 0;
    if (await tableExists(this.pg, 'crm_leads')) {
      const result = await this.pg.query(`SELECT COUNT(*)::bigint AS v FROM crm_leads WHERE ${where}`);
      count = Number(result.rows[0]?.v ?? 0);
    }
    return {
      columns: [
        { key: 'metric', label: 'Chỉ số', type: 'string' },
        { key: 'count', label: 'Giá trị', type: 'number' },
      ],
      rows: [{ metric, count }],
    };
  }

  private async countLeadsStale7d(): Promise<NlQueryExecutionResult> {
    let count = 0;
    if (await tableExists(this.pg, 'crm_leads')) {
      const result = await this.pg.query(
        `SELECT COUNT(*)::bigint AS v FROM crm_leads
         WHERE lower(COALESCE(status, '')) NOT IN ('won', 'lost', 'closed_won', 'closed_lost')
           AND updated_at::date <= $1::date`,
        [daysAgoYmd(7)],
      );
      count = Number(result.rows[0]?.v ?? 0);
    }
    return {
      columns: [
        { key: 'metric', label: 'Chỉ số', type: 'string' },
        { key: 'count', label: 'Giá trị', type: 'number' },
      ],
      rows: [{ metric: 'Lead không cập nhật 7 ngày', count }],
    };
  }

  private async leadConversionRate(): Promise<NlQueryExecutionResult> {
    const total = await this.countLeadsRange(
      daysAgoYmd(29),
      todayYmd(),
      'COALESCE(is_duplicate, false) = false',
    );
    const won = await this.countLeadsRange(
      daysAgoYmd(29),
      todayYmd(),
      `COALESCE(is_duplicate, false) = false AND lower(COALESCE(status, '')) IN ('won', 'closed_won')`,
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

  private async stalledDeals(): Promise<NlQueryExecutionResult> {
    let count = 0;
    if (await tableExists(this.pg, 'crm_cases')) {
      const result = await this.pg.query(
        `SELECT COUNT(*)::bigint AS v FROM crm_cases
         WHERE lower(COALESCE(status, '')) NOT IN ('closed', 'won', 'lost')
           AND updated_at <= NOW() - INTERVAL '14 days'`,
      );
      count = Number(result.rows[0]?.v ?? 0);
    }
    return {
      columns: [{ key: 'count', label: 'Deal treo >14 ngày', type: 'number' }],
      rows: [{ count }],
      drill_href: '/crm/sales',
    };
  }

  private async overduePayments(): Promise<NlQueryExecutionResult> {
    let count = 0;
    let amount = 0;
    if (await tableExists(this.pg, 'crm_svc_payments')) {
      const result = await this.pg.query(
        `SELECT COUNT(*)::bigint AS count, COALESCE(SUM(amount_vnd), 0)::bigint AS amount
         FROM crm_svc_payments
         WHERE status = 'pending' AND due_on::date < CURRENT_DATE`,
      );
      count = Number(result.rows[0]?.count ?? 0);
      amount = Number(result.rows[0]?.amount ?? 0);
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
