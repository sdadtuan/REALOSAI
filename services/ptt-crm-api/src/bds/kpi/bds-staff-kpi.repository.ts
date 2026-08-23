import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { CSKH_FIRST_CALL_SLA_MINUTES } from '../../cskh-board/cskh-board-sla.util';
import { buildReBuyerListFilter } from '../../leads-funnel/lead-flow-list-filter.util';

export type BdsStaffKpiMetrics = {
  metrics: Array<{ key: string; label: string; value: number; target?: number | null }>;
};

@Injectable()
export class BdsStaffKpiRepository implements OnModuleDestroy {
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

  async staffMetrics(
    staffId: number,
    tenantId: string,
    year: number,
    month: number,
  ): Promise<BdsStaffKpiMetrics> {
    const [gmv, holdPct, touchPct] = await Promise.all([
      this.gmvHdmbMonth(staffId, tenantId, year, month),
      this.holdToDepositPct(staffId, tenantId, year, month),
      this.firstTouch15mPct(staffId, tenantId, year, month),
    ]);
    return {
      metrics: [
        {
          key: 'bds_gmv_hdmb_vnd',
          label: 'GMV HĐMB tháng (VND)',
          value: gmv,
          target: null,
        },
        {
          key: 'bds_hold_to_deposit_pct',
          label: 'Hold → cọc (%)',
          value: holdPct,
          target: 35,
        },
        {
          key: 'bds_first_touch_15m_pct',
          label: 'First-touch ≤15p (%)',
          value: touchPct,
          target: 90,
        },
      ],
    };
  }

  private monthBounds(year: number, month: number): { from: string; to: string } {
    const m = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    return {
      from: `${year}-${m}-01T00:00:00.000Z`,
      to: `${year}-${m}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`,
    };
  }

  private async gmvHdmbMonth(
    staffId: number,
    tenantId: string,
    year: number,
    month: number,
  ): Promise<number> {
    try {
      const { from, to } = this.monthBounds(year, month);
      const res = await this.db.query<{ sum: string | null }>(
        `SELECT COALESCE(SUM(net_price_vnd), 0)::text AS sum
         FROM bds_transactions
         WHERE tenant_id = $1::uuid
           AND closer_staff_id = $2
           AND stage = 'contracted'
           AND contracted_at >= $3::timestamptz
           AND contracted_at <= $4::timestamptz`,
        [tenantId, staffId, from, to],
      );
      return Number(res.rows[0]?.sum ?? 0);
    } catch {
      return 0;
    }
  }

  private async holdToDepositPct(
    staffId: number,
    tenantId: string,
    year: number,
    month: number,
  ): Promise<number> {
    try {
      const { from, to } = this.monthBounds(year, month);
      const res = await this.db.query<{ total: string; deposited: string }>(
        `SELECT
           COUNT(*)::text AS total,
           COUNT(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM bds_transactions t
               WHERE t.hold_id = h.id
                 AND t.stage IN ('deposit', 'vbtt', 'contracted', 'handed_over', 'title_issued')
             )
           )::text AS deposited
         FROM bds_holds h
         WHERE h.tenant_id = $1::uuid
           AND h.requested_by_staff_id = $2
           AND h.created_at >= $3::timestamptz
           AND h.created_at <= $4::timestamptz
           AND h.status IN ('active', 'converted', 'cancelled', 'expired')`,
        [tenantId, staffId, from, to],
      );
      const total = Number(res.rows[0]?.total ?? 0);
      const deposited = Number(res.rows[0]?.deposited ?? 0);
      if (total <= 0) return 0;
      return Math.round((deposited / total) * 1000) / 10;
    } catch {
      return 0;
    }
  }

  private async firstTouch15mPct(
    staffId: number,
    tenantId: string,
    year: number,
    month: number,
  ): Promise<number> {
    try {
      const { from, to } = this.monthBounds(year, month);
      const reBuyer = buildReBuyerListFilter('postgres', 'l');
      const res = await this.db.query<{ total: string; ok: string }>(
        `SELECT
           COUNT(*)::text AS total,
           COUNT(*) FILTER (
             WHERE NULLIF(trim(l.meta_json::jsonb->>'touched_at'), '') IS NOT NULL
               AND (l.meta_json::jsonb->>'touched_at')::timestamptz
                   <= l.received_at + ($5::int * interval '1 minute')
           )::text AS ok
         FROM crm_leads l
         WHERE l.tenant_id = $1::uuid
           AND l.owner_id = $2
           AND (${reBuyer})
           AND l.received_at >= $3::timestamptz
           AND l.received_at <= $4::timestamptz`,
        [tenantId, staffId, from, to, CSKH_FIRST_CALL_SLA_MINUTES],
      );
      const total = Number(res.rows[0]?.total ?? 0);
      const ok = Number(res.rows[0]?.ok ?? 0);
      if (total <= 0) return 0;
      return Math.round((ok / total) * 1000) / 10;
    } catch {
      return 0;
    }
  }
}
