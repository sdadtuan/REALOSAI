import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export interface B2bCommissionSplitRow {
  first_touch_staff_id: number | null;
  closer_staff_id: number | null;
  first_touch_pct: number;
  closer_pct: number;
}

export interface B2bCommissionLedgerRow {
  id: string;
  lead_id: number;
  contract_id: number;
  first_touch_staff_id: number | null;
  closer_staff_id: number | null;
  first_touch_amt: number;
  closer_amt: number;
  status: string;
  posted_at: string;
}

@Injectable()
export class B2bCommissionLedgerRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async loadSplit(leadId: number): Promise<B2bCommissionSplitRow | null> {
    const result = await this.db.query(
      `SELECT first_touch_staff_id, closer_staff_id, first_touch_pct, closer_pct
       FROM crm_b2b_lead_commission_split WHERE lead_id = $1 LIMIT 1`,
      [leadId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      first_touch_staff_id: row.first_touch_staff_id != null ? Number(row.first_touch_staff_id) : null,
      closer_staff_id: row.closer_staff_id != null ? Number(row.closer_staff_id) : null,
      first_touch_pct: Number(row.first_touch_pct),
      closer_pct: Number(row.closer_pct),
    };
  }

  async insertPosted(input: {
    leadId: number;
    contractId: number;
    firstTouchStaffId: number | null;
    closerStaffId: number | null;
    firstTouchAmt: number;
    closerAmt: number;
  }): Promise<B2bCommissionLedgerRow | null> {
    const result = await this.db.query(
      `INSERT INTO crm_b2b_commission_ledger
         (lead_id, contract_id, first_touch_staff_id, closer_staff_id, first_touch_amt, closer_amt, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'posted')
       ON CONFLICT (lead_id, contract_id) DO NOTHING
       RETURNING id::text, lead_id, contract_id, first_touch_staff_id, closer_staff_id,
                 first_touch_amt, closer_amt, status, posted_at::text`,
      [
        input.leadId,
        input.contractId,
        input.firstTouchStaffId,
        input.closerStaffId,
        input.firstTouchAmt,
        input.closerAmt,
      ],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      lead_id: Number(row.lead_id),
      contract_id: Number(row.contract_id),
      first_touch_staff_id: row.first_touch_staff_id != null ? Number(row.first_touch_staff_id) : null,
      closer_staff_id: row.closer_staff_id != null ? Number(row.closer_staff_id) : null,
      first_touch_amt: Number(row.first_touch_amt),
      closer_amt: Number(row.closer_amt),
      status: String(row.status),
      posted_at: String(row.posted_at),
    };
  }
}
