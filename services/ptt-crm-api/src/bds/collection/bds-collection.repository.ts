import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type {
  InstallmentRow,
  MortgageRow,
  ReceiptRow,
  ScheduleRow,
} from './bds-collection.types';

@Injectable()
export class BdsCollectionRepository implements OnModuleDestroy {
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

  private optStr(value: unknown): string | null {
    return value != null ? String(value) : null;
  }

  private asDate(value: unknown): Date {
    if (value instanceof Date) return value;
    return new Date(String(value));
  }

  private mapSchedule(row: Record<string, unknown>): ScheduleRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      transaction_id: String(row.transaction_id),
      project_id: Number(row.project_id),
      policy_id: this.optStr(row.policy_id),
      source: String(row.source) as ScheduleRow['source'],
      created_at: this.asDate(row.created_at),
    };
  }

  private mapInstallment(row: Record<string, unknown>): InstallmentRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      schedule_id: String(row.schedule_id),
      transaction_id: String(row.transaction_id),
      seq: Number(row.seq ?? 0),
      milestone_code: String(row.milestone_code ?? ''),
      due_date: this.asDate(row.due_date),
      amount_vnd: Number(row.amount_vnd ?? 0),
      paid_vnd: Number(row.paid_vnd ?? 0),
      status: String(row.status) as InstallmentRow['status'],
      overdue_days: Number(row.overdue_days ?? 0),
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  private mapReceipt(row: Record<string, unknown>): ReceiptRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      transaction_id: String(row.transaction_id),
      installment_id: this.optStr(row.installment_id),
      receipt_no: String(row.receipt_no ?? ''),
      amount_vnd: Number(row.amount_vnd ?? 0),
      paid_at: this.asDate(row.paid_at),
      method: String(row.method) as ReceiptRow['method'],
      note: String(row.note ?? ''),
      created_by: String(row.created_by ?? ''),
      created_at: this.asDate(row.created_at),
    };
  }

  private mapMortgage(row: Record<string, unknown>): MortgageRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      transaction_id: String(row.transaction_id),
      bank_name: String(row.bank_name ?? ''),
      amount_vnd: Number(row.amount_vnd ?? 0),
      status: String(row.status) as MortgageRow['status'],
      file_id: String(row.file_id ?? ''),
      note: String(row.note ?? ''),
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  async getScheduleByTx(transactionId: string): Promise<ScheduleRow | null> {
    const res = await this.db.query(
      `SELECT * FROM bds_payment_schedules WHERE transaction_id = $1 LIMIT 1`,
      [transactionId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapSchedule(row) : null;
  }

  async insertSchedule(input: {
    tenant_id?: string | null;
    transaction_id: string;
    project_id: number;
    policy_id?: string | null;
    source?: ScheduleRow['source'];
  }): Promise<ScheduleRow> {
    const res = await this.db.query(
      `INSERT INTO bds_payment_schedules (tenant_id, transaction_id, project_id, policy_id, source)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.tenant_id ?? null,
        input.transaction_id,
        input.project_id,
        input.policy_id ?? null,
        input.source ?? 'deposit',
      ],
    );
    return this.mapSchedule(res.rows[0] as Record<string, unknown>);
  }

  async insertInstallments(
    rows: Array<{
      tenant_id?: string | null;
      schedule_id: string;
      transaction_id: string;
      seq: number;
      milestone_code: string;
      due_date: Date;
      amount_vnd: number;
    }>,
  ): Promise<InstallmentRow[]> {
    const out: InstallmentRow[] = [];
    for (const row of rows) {
      const res = await this.db.query(
        `INSERT INTO bds_payment_installments (
           tenant_id, schedule_id, transaction_id, seq, milestone_code, due_date, amount_vnd
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          row.tenant_id ?? null,
          row.schedule_id,
          row.transaction_id,
          row.seq,
          row.milestone_code,
          row.due_date.toISOString().slice(0, 10),
          row.amount_vnd,
        ],
      );
      out.push(this.mapInstallment(res.rows[0] as Record<string, unknown>));
    }
    return out;
  }

  async insertReceipt(input: {
    tenant_id?: string | null;
    transaction_id: string;
    installment_id?: string | null;
    receipt_no?: string;
    amount_vnd: number;
    paid_at: Date;
    method: ReceiptRow['method'];
    note?: string;
    created_by?: string;
  }): Promise<ReceiptRow> {
    const res = await this.db.query(
      `INSERT INTO bds_receipts (
         tenant_id, transaction_id, installment_id, receipt_no, amount_vnd, paid_at, method, note, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.tenant_id ?? null,
        input.transaction_id,
        input.installment_id ?? null,
        String(input.receipt_no ?? ''),
        input.amount_vnd,
        input.paid_at,
        input.method,
        String(input.note ?? ''),
        String(input.created_by ?? ''),
      ],
    );
    return this.mapReceipt(res.rows[0] as Record<string, unknown>);
  }

  async sumReceiptsByTx(transactionId: string): Promise<number> {
    const res = await this.db.query(
      `SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS total
       FROM bds_receipts WHERE transaction_id = $1`,
      [transactionId],
    );
    return Number((res.rows[0] as Record<string, unknown>).total ?? 0);
  }

  async hasReceiptForMilestone(transactionId: string, milestoneCode: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1
       FROM bds_receipts r
       JOIN bds_payment_installments i ON i.id = r.installment_id
       WHERE r.transaction_id = $1 AND i.milestone_code = $2
       LIMIT 1`,
      [transactionId, milestoneCode],
    );
    return res.rows.length > 0;
  }

  async listInstallmentsByTx(transactionId: string): Promise<InstallmentRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_payment_installments
       WHERE transaction_id = $1
       ORDER BY seq ASC`,
      [transactionId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapInstallment(row));
  }

  async listOverdueInstallments(projectId: number, asOf: Date): Promise<InstallmentRow[]> {
    const res = await this.db.query(
      `SELECT i.*
       FROM bds_payment_installments i
       JOIN bds_transactions t ON t.id = i.transaction_id
       WHERE t.project_id = $1
         AND t.stage NOT IN ('cancelled', 'lost')
         AND i.status IN ('due', 'partial', 'overdue')
         AND i.due_date < $2::date
       ORDER BY i.due_date ASC`,
      [projectId, asOf.toISOString().slice(0, 10)],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapInstallment(row));
  }

  async updateInstallmentPaid(
    installmentId: string,
    paidVnd: number,
    status: InstallmentRow['status'],
    overdueDays: number,
  ): Promise<void> {
    await this.db.query(
      `UPDATE bds_payment_installments
       SET paid_vnd = $2, status = $3, overdue_days = $4, updated_at = NOW()
       WHERE id = $1`,
      [installmentId, paidVnd, status, overdueDays],
    );
  }

  async getInstallment(id: string): Promise<InstallmentRow | null> {
    const res = await this.db.query(
      `SELECT * FROM bds_payment_installments WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapInstallment(row) : null;
  }

  async updateTxPaidPct(transactionId: string, paidPct: number): Promise<void> {
    await this.db.query(
      `UPDATE bds_transactions SET paid_pct = $2, updated_at = NOW() WHERE id = $1`,
      [transactionId, paidPct],
    );
  }

  async updateTxMortgageStatus(
    transactionId: string,
    status: MortgageRow['status'],
  ): Promise<void> {
    await this.db.query(
      `UPDATE bds_transactions SET mortgage_status = $2, updated_at = NOW() WHERE id = $1`,
      [transactionId, status],
    );
  }

  async upsertMortgage(input: {
    tenant_id?: string | null;
    transaction_id: string;
    bank_name?: string;
    amount_vnd?: number;
    status?: MortgageRow['status'];
    file_id?: string;
    note?: string;
  }): Promise<MortgageRow> {
    const res = await this.db.query(
      `INSERT INTO bds_mortgages (
         tenant_id, transaction_id, bank_name, amount_vnd, status, file_id, note
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (transaction_id) DO UPDATE SET
         bank_name = EXCLUDED.bank_name,
         amount_vnd = EXCLUDED.amount_vnd,
         status = EXCLUDED.status,
         file_id = EXCLUDED.file_id,
         note = EXCLUDED.note,
         updated_at = NOW()
       RETURNING *`,
      [
        input.tenant_id ?? null,
        input.transaction_id,
        String(input.bank_name ?? ''),
        input.amount_vnd ?? 0,
        input.status ?? 'applying',
        String(input.file_id ?? ''),
        String(input.note ?? ''),
      ],
    );
    return this.mapMortgage(res.rows[0] as Record<string, unknown>);
  }

  async getMortgage(transactionId: string): Promise<MortgageRow | null> {
    const res = await this.db.query(
      `SELECT * FROM bds_mortgages WHERE transaction_id = $1 LIMIT 1`,
      [transactionId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapMortgage(row) : null;
  }

  async listReceiptsForExport(
    projectId: number,
    from?: string,
    to?: string,
  ): Promise<Array<ReceiptRow & { project_id: number }>> {
    const params: unknown[] = [projectId];
    let sql = `
      SELECT r.*, t.project_id
      FROM bds_receipts r
      JOIN bds_transactions t ON t.id = r.transaction_id
      WHERE t.project_id = $1`;
    if (from) {
      params.push(from);
      sql += ` AND r.paid_at >= $${params.length}::timestamptz`;
    }
    if (to) {
      params.push(to);
      sql += ` AND r.paid_at <= $${params.length}::timestamptz`;
    }
    sql += ` ORDER BY r.paid_at ASC`;
    const res = await this.db.query(sql, params);
    return (res.rows as Record<string, unknown>[]).map((row) => ({
      ...this.mapReceipt(row),
      project_id: Number(row.project_id),
    }));
  }
}
