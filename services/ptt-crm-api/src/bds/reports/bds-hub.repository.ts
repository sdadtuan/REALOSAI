import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { isBdsCollectionEnabled } from '../bds.flags';
import type { HubInboxRow, HubKpi, LeaderboardRow } from './bds-hub.types';
import { sellThroughPct } from './bds-hub.util';

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

  async kpi(tenantId: string): Promise<HubKpi> {
    const sell = await this.sellThrough(tenantId);
    const gmv = await this.gmvContractedMonth(tenantId);
    const overdue = isBdsCollectionEnabled() ? await this.overdueGt30d(tenantId) : 0;
    const holdsExpiring = await this.holdsExpiring2h(tenantId);
    return {
      sell_through_pct: sell,
      gmv_contracted_month_vnd: gmv,
      overdue_gt_30d: overdue,
      holds_expiring_2h: holdsExpiring,
    };
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
