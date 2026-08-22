import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type {
  AftersalesBoardRow,
  AftersalesTicketRow,
  HandoverCheckRow,
} from './bds-aftersales.types';

@Injectable()
export class BdsAftersalesRepository implements OnModuleDestroy {
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

  private optDate(value: unknown): Date | null {
    if (value == null || value === '') return null;
    return value instanceof Date ? value : new Date(String(value));
  }

  private asDate(value: unknown): Date {
    if (value instanceof Date) return value;
    return new Date(String(value));
  }

  private mapCheck(row: Record<string, unknown>): HandoverCheckRow {
    return {
      id: String(row.id),
      tenant_id: row.tenant_id != null ? String(row.tenant_id) : null,
      transaction_id: String(row.transaction_id),
      item_code: String(row.item_code) as HandoverCheckRow['item_code'],
      status: String(row.status) as HandoverCheckRow['status'],
      note: String(row.note ?? ''),
      checked_by: row.checked_by == null ? null : Number(row.checked_by),
      checked_at: this.optDate(row.checked_at),
    };
  }

  private mapTicket(row: Record<string, unknown>): AftersalesTicketRow {
    return {
      id: String(row.id),
      tenant_id: row.tenant_id != null ? String(row.tenant_id) : null,
      transaction_id: String(row.transaction_id),
      kind: String(row.kind) as AftersalesTicketRow['kind'],
      status: String(row.status) as AftersalesTicketRow['status'],
      title: String(row.title),
      body: String(row.body ?? ''),
      opened_by: row.opened_by == null ? null : Number(row.opened_by),
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  async listBoard(tenantId: string, projectId?: number): Promise<Omit<AftersalesBoardRow, 'appointment_due'>[]> {
    const res = await this.db.query(
      `SELECT t.id AS transaction_id, t.project_id, t.product_id, t.stage, t.contract_no,
              t.handover_appointment_at, t.title_status,
              COALESCE((
                SELECT COUNT(*)::int FROM bds_handover_checks c
                WHERE c.transaction_id = t.id AND c.status = 'pass'
              ), 0) AS checks_passed,
              4 AS checks_total,
              COALESCE((
                SELECT COUNT(*)::int FROM bds_aftersales_tickets d
                WHERE d.transaction_id = t.id AND d.kind = 'defect'
                  AND d.status IN ('open', 'in_progress')
              ), 0) AS open_defects
       FROM bds_transactions t
       WHERE t.tenant_id = $1
         AND t.stage IN ('contracted', 'handed_over', 'title_issued')
         AND ($2::int IS NULL OR t.project_id = $2)
       ORDER BY t.contracted_at ASC NULLS LAST`,
      [tenantId, projectId ?? null],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => ({
      transaction_id: String(row.transaction_id),
      project_id: Number(row.project_id),
      product_id: Number(row.product_id),
      stage: String(row.stage),
      contract_no: String(row.contract_no ?? ''),
      handover_appointment_at: this.optDate(row.handover_appointment_at),
      title_status: String(row.title_status ?? 'not_started') as AftersalesBoardRow['title_status'],
      checks_passed: Number(row.checks_passed ?? 0),
      checks_total: Number(row.checks_total ?? 4),
      open_defects: Number(row.open_defects ?? 0),
    }));
  }

  async listChecks(txId: string): Promise<HandoverCheckRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_handover_checks WHERE transaction_id = $1 ORDER BY item_code ASC`,
      [txId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapCheck(row));
  }

  async upsertCheck(input: {
    tenant_id: string | null;
    transaction_id: string;
    item_code: string;
    status: string;
    note: string;
    checked_by: number | null;
  }): Promise<HandoverCheckRow> {
    const now = new Date();
    const res = await this.db.query(
      `INSERT INTO bds_handover_checks (
         tenant_id, transaction_id, item_code, status, note, checked_by, checked_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (transaction_id, item_code) DO UPDATE SET
         status = EXCLUDED.status,
         note = EXCLUDED.note,
         checked_by = EXCLUDED.checked_by,
         checked_at = EXCLUDED.checked_at
       RETURNING *`,
      [
        input.tenant_id,
        input.transaction_id,
        input.item_code,
        input.status,
        input.note,
        input.checked_by,
        now,
      ],
    );
    return this.mapCheck(res.rows[0] as Record<string, unknown>);
  }

  async listTickets(txId: string): Promise<AftersalesTicketRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_aftersales_tickets WHERE transaction_id = $1 ORDER BY created_at DESC`,
      [txId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapTicket(row));
  }

  async insertTicket(input: {
    tenant_id: string | null;
    transaction_id: string;
    kind: string;
    title: string;
    body: string;
    opened_by: number | null;
  }): Promise<AftersalesTicketRow> {
    const res = await this.db.query(
      `INSERT INTO bds_aftersales_tickets (
         tenant_id, transaction_id, kind, title, body, opened_by
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.tenant_id,
        input.transaction_id,
        input.kind,
        input.title,
        input.body,
        input.opened_by,
      ],
    );
    return this.mapTicket(res.rows[0] as Record<string, unknown>);
  }

  async updateTicketStatus(
    id: string,
    status: string,
    tenantId?: string,
  ): Promise<AftersalesTicketRow | null> {
    const params: unknown[] = [status, id];
    let sql = `UPDATE bds_aftersales_tickets SET status = $1, updated_at = NOW() WHERE id = $2`;
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $3`;
    }
    sql += ` RETURNING *`;
    const res = await this.db.query(sql, params);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapTicket(row) : null;
  }

  async countOpenDefects(txId: string): Promise<number> {
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM bds_aftersales_tickets
       WHERE transaction_id = $1 AND kind = 'defect' AND status IN ('open', 'in_progress')`,
      [txId],
    );
    return Number((res.rows[0] as { n?: number }).n ?? 0);
  }
}
