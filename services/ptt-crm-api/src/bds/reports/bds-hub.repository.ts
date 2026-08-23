import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { isReProjectsPgPrimary } from '../inventory/bds-dual-write.util';
import {
  isBdsBuyerEnabled,
  isBdsCollectionEnabled,
  isBdsCommissionEnabled,
  isBdsPackEnabled,
  isBdsUiEnabled,
} from '../bds.flags';
import { CSKH_FIRST_CALL_SLA_MINUTES } from '../../cskh-board/cskh-board-sla.util';
import { buildReBuyerListFilter } from '../../leads-funnel/lead-flow-list-filter.util';
import type { HubInboxRow, HubKpi, LeaderboardRow } from './bds-hub.types';
import { sellThroughPct, withW7HubKpi } from './bds-hub.util';

@Injectable()
export class BdsHubRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async metaAdMapped(tenantId: string): Promise<boolean> {
    try {
      const res = await this.db.query<{ id: number }>(
        `SELECT id FROM crm_re_projects WHERE tenant_id = $1::uuid`,
        [tenantId],
      );
      const ids = res.rows.map((r) => Number(r.id)).filter((id) => id > 0);
      if (ids.length === 0) return false;
      if (isReProjectsPgPrimary()) {
        const mapped = await this.db.query(
          `SELECT 1 AS ok FROM crm_re_project_lead_config
           WHERE project_id = ANY($1::int[])
             AND trim(COALESCE(meta_ad_account_id, '')) <> ''
           LIMIT 1`,
          [ids],
        );
        return Boolean(mapped.rows[0]);
      }
      const { DatabaseSync } = await import('node:sqlite');
      const sqlite = new DatabaseSync(this.config.sqlitePath);
      try {
        const cols = sqlite.prepare('PRAGMA table_info(crm_re_project_lead_config)').all() as Array<{
          name: string;
        }>;
        if (!cols.some((c) => c.name === 'meta_ad_account_id')) return false;
        const placeholders = ids.map(() => '?').join(',');
        const row = sqlite
          .prepare(
            `SELECT 1 AS ok FROM crm_re_project_lead_config
             WHERE project_id IN (${placeholders})
               AND TRIM(COALESCE(meta_ad_account_id, '')) <> ''
             LIMIT 1`,
          )
          .get(...ids) as { ok?: number } | undefined;
        return Boolean(row?.ok);
      } finally {
        sqlite.close();
      }
    } catch {
      return false;
    }
  }

  async kpi(tenantId: string): Promise<HubKpi> {
    const sell = await this.sellThrough(tenantId);
    const gmv = await this.gmvContractedMonth(tenantId);
    const overdue = isBdsCollectionEnabled() ? await this.overdueGt30d(tenantId) : 0;
    const holdsExpiring = await this.holdsExpiring2h(tenantId);
    const cskh =
      isBdsPackEnabled() && isBdsBuyerEnabled() && isBdsUiEnabled()
        ? await this.cskhBreach15m(tenantId)
        : 0;
    const receipts = isBdsCollectionEnabled() ? await this.receiptsToday(tenantId) : 0;
    const collected = isBdsCollectionEnabled() ? await this.collectedMonth(tenantId) : 0;
    const hh = isBdsCommissionEnabled() ? await this.hhPayableMonth(tenantId) : 0;
    return withW7HubKpi({
      sell_through_pct: sell,
      gmv_contracted_month_vnd: gmv,
      overdue_gt_30d: overdue,
      holds_expiring_2h: holdsExpiring,
      cskh_breach_15m: cskh,
      receipts_today_count: receipts,
      collected_month_vnd: collected,
      hh_payable_month_vnd: hh,
    });
  }

  private async sellThrough(tenantId: string): Promise<number> {
    try {
      const res = await this.db.query<{ sold: string; total: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'sold')::text AS sold,
           COUNT(*) FILTER (WHERE status <> 'locked')::text AS total
         FROM crm_re_project_products
         WHERE tenant_id = $1::uuid`,
        [tenantId],
      );
      const sold = Number(res.rows[0]?.sold ?? 0);
      const total = Number(res.rows[0]?.total ?? 0);
      return sellThroughPct(sold, total);
    } catch {
      return 0;
    }
  }

  private async gmvContractedMonth(tenantId: string): Promise<number> {
    try {
      const res = await this.db.query<{ sum: string | null }>(
        `SELECT COALESCE(SUM(net_price_vnd), 0)::text AS sum
         FROM bds_transactions
         WHERE tenant_id = $1::uuid
           AND stage = 'contracted'
           AND contracted_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
           AND contracted_at < date_trunc('month', NOW() AT TIME ZONE 'UTC') + interval '1 month'`,
        [tenantId],
      );
      return Number(res.rows[0]?.sum ?? 0);
    } catch {
      return 0;
    }
  }

  private async overdueGt30d(tenantId: string): Promise<number> {
    try {
      const res = await this.db.query<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt
         FROM bds_payment_installments
         WHERE tenant_id = $1::uuid
           AND (status = 'overdue' OR overdue_days > 30)`,
        [tenantId],
      );
      return Number(res.rows[0]?.cnt ?? 0);
    } catch {
      return 0;
    }
  }

  private async holdsExpiring2h(tenantId: string): Promise<number> {
    try {
      const res = await this.db.query<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt
         FROM bds_holds
         WHERE tenant_id = $1::uuid
           AND status IN ('pending', 'active')
           AND expires_at IS NOT NULL
           AND expires_at <= NOW() + interval '2 hours'`,
        [tenantId],
      );
      return Number(res.rows[0]?.cnt ?? 0);
    } catch {
      return 0;
    }
  }

  private async cskhBreach15m(tenantId: string): Promise<number> {
    try {
      const reBuyer = buildReBuyerListFilter('postgres', 'l');
      const res = await this.db.query<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt
         FROM crm_leads l
         WHERE l.tenant_id = $1::uuid
           AND (${reBuyer})
           AND l.received_at IS NOT NULL
           AND l.received_at < NOW() - ($2::int * interval '1 minute')
           AND NOT EXISTS (
             SELECT 1 FROM crm_lead_activities a
             WHERE a.lead_id = l.id AND a.activity_type = 'call'
           )
           AND lower(trim(COALESCE(l.status, ''))) NOT IN ('chot', 'lost', 'closed', 'won')`,
        [tenantId, CSKH_FIRST_CALL_SLA_MINUTES],
      );
      return Number(res.rows[0]?.cnt ?? 0);
    } catch {
      return 0;
    }
  }

  private async receiptsToday(tenantId: string): Promise<number> {
    try {
      const res = await this.db.query<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt
         FROM bds_receipts r
         JOIN bds_transactions t ON t.id = r.transaction_id
         WHERE t.tenant_id = $1::uuid
           AND r.paid_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
           AND r.paid_at < date_trunc('day', NOW() AT TIME ZONE 'UTC') + interval '1 day'`,
        [tenantId],
      );
      return Number(res.rows[0]?.cnt ?? 0);
    } catch {
      return 0;
    }
  }

  private async collectedMonth(tenantId: string): Promise<number> {
    try {
      const res = await this.db.query<{ sum: string | null }>(
        `SELECT COALESCE(SUM(r.amount_vnd), 0)::text AS sum
         FROM bds_receipts r
         JOIN bds_transactions t ON t.id = r.transaction_id
         WHERE t.tenant_id = $1::uuid
           AND r.paid_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
           AND r.paid_at < date_trunc('month', NOW() AT TIME ZONE 'UTC') + interval '1 month'`,
        [tenantId],
      );
      return Number(res.rows[0]?.sum ?? 0);
    } catch {
      return 0;
    }
  }

  private async hhPayableMonth(tenantId: string): Promise<number> {
    try {
      const res = await this.db.query<{ sum: string | null }>(
        `SELECT COALESCE(
           SUM(CASE WHEN status = 'accrued' THEN amount_vnd ELSE 0 END)
           - SUM(CASE WHEN status = 'paid' THEN amount_vnd ELSE 0 END)
           - SUM(CASE WHEN status = 'clawback' THEN amount_vnd ELSE 0 END)
         , 0)::text AS sum
         FROM bds_commission_ledger
         WHERE tenant_id = $1::uuid
           AND period_month >= date_trunc('month', NOW() AT TIME ZONE 'UTC')::date
           AND period_month < (date_trunc('month', NOW() AT TIME ZONE 'UTC') + interval '1 month')::date`,
        [tenantId],
      );
      return Number(res.rows[0]?.sum ?? 0);
    } catch {
      return 0;
    }
  }

  async pendingHolds(tenantId: string): Promise<HubInboxRow[]> {
    try {
      const res = await this.db.query<{ id: string; label: string }>(
        `SELECT h.id::text AS id,
                COALESCE(NULLIF(TRIM(p.unit_code), ''), h.id::text) AS label
         FROM bds_holds h
         JOIN crm_re_project_products p ON p.id = h.product_id
         WHERE h.tenant_id = $1::uuid
           AND h.status = 'pending'
         ORDER BY h.created_at ASC
         LIMIT 8`,
        [tenantId],
      );
      return res.rows.map((row) => ({
        kind: 'hold_f1_pending' as const,
        id: row.id,
        label: row.label,
        href: '/crm/bds/holds',
      }));
    } catch {
      return [];
    }
  }

  async byTower(tenantId: string): Promise<Array<{ tower_code: string; pct: number }>> {
    try {
      const res = await this.db.query<{ tower_code: string; sold: string; total: string }>(
        `SELECT COALESCE(NULLIF(TRIM(tower), ''), '—') AS tower_code,
                COUNT(*) FILTER (WHERE status = 'sold')::text AS sold,
                COUNT(*) FILTER (WHERE status <> 'locked')::text AS total
         FROM crm_re_project_products
         WHERE tenant_id = $1::uuid
         GROUP BY 1
         ORDER BY 1`,
        [tenantId],
      );
      return res.rows.map((row) => ({
        tower_code: row.tower_code,
        pct: sellThroughPct(Number(row.sold), Number(row.total)),
      }));
    } catch {
      return [];
    }
  }

  async byAgency(tenantId: string): Promise<Array<{ agency_id: string; name: string; units: number }>> {
    try {
      const res = await this.db.query<{ agency_id: string; name: string; units: string }>(
        `SELECT t.channel_partner_id AS agency_id,
                COALESCE(a.name, t.channel_partner_id) AS name,
                COUNT(*)::text AS units
         FROM bds_transactions t
         LEFT JOIN bds_agencies a ON a.id::text = t.channel_partner_id
         WHERE t.tenant_id = $1::uuid
           AND t.stage = 'contracted'
           AND t.contracted_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
           AND t.contracted_at < date_trunc('month', NOW() AT TIME ZONE 'UTC') + interval '1 month'
           AND NULLIF(TRIM(t.channel_partner_id), '') IS NOT NULL
         GROUP BY t.channel_partner_id, a.name
         ORDER BY COUNT(*) DESC
         LIMIT 5`,
        [tenantId],
      );
      return res.rows.map((row) => ({
        agency_id: row.agency_id,
        name: row.name,
        units: Number(row.units),
      }));
    } catch {
      return [];
    }
  }

  async listLeaderboard(tenantId: string, periodMonth: string): Promise<LeaderboardRow[]> {
    try {
      const res = await this.db.query<{
        agency_id: string;
        name: string;
        total_score: string;
        from_tier_id: string | null;
        to_tier_id: string | null;
      }>(
        `SELECT s.agency_id::text AS agency_id,
                COALESCE(a.name, s.agency_id::text) AS name,
                s.total_score::text AS total_score,
                s.from_tier_id::text AS from_tier_id,
                s.to_tier_id::text AS to_tier_id
         FROM bds_agency_tier_scores s
         JOIN bds_agencies a ON a.id = s.agency_id
         WHERE s.tenant_id = $1::uuid
           AND s.period_month = $2::date
         ORDER BY s.total_score DESC`,
        [tenantId, periodMonth],
      );
      return res.rows.map((row) => ({
        agency_id: row.agency_id,
        name: row.name,
        total_score: Number(row.total_score),
        from_tier_id: row.from_tier_id,
        to_tier_id: row.to_tier_id,
      }));
    } catch {
      return [];
    }
  }
}
