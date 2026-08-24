import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { LifecycleFinanceConfirmRow } from './lifecycle-finance-confirm.types';

export function mapLifecycleFinanceConfirmRow(row: Record<string, unknown>): LifecycleFinanceConfirmRow {
  return {
    id: Number(row.id),
    lifecycle_id: Number(row.lifecycle_id),
    staff_id: row.staff_id != null ? Number(row.staff_id) : null,
    staff_email: String(row.staff_email ?? ''),
    outstanding_vnd: Number(row.outstanding_vnd ?? 0),
    ar_pending_vnd: Number(row.ar_pending_vnd ?? 0),
    ar_overdue_vnd: Number(row.ar_overdue_vnd ?? 0),
    strict_mode: Boolean(row.strict_mode),
    note: row.note != null ? String(row.note) : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
  };
}

@Injectable()
export class LifecycleFinanceConfirmPgRepository implements OnModuleDestroy {
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

  async insertConfirm(input: {
    lifecycleId: number;
    staffId?: number | null;
    staffEmail: string;
    outstandingVnd: number;
    arPendingVnd: number;
    arOverdueVnd: number;
    strictMode: boolean;
    note?: string | null;
  }): Promise<LifecycleFinanceConfirmRow> {
    const result = await this.db.query<Record<string, unknown>>(
      `INSERT INTO crm_lifecycle_finance_confirm
         (lifecycle_id, staff_id, staff_email, outstanding_vnd, ar_pending_vnd, ar_overdue_vnd, strict_mode, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.lifecycleId,
        input.staffId ?? null,
        input.staffEmail,
        input.outstandingVnd,
        input.arPendingVnd,
        input.arOverdueVnd,
        input.strictMode,
        input.note ?? null,
      ],
    );
    return mapLifecycleFinanceConfirmRow(result.rows[0] ?? {});
  }

  async listForLifecycle(lifecycleId: number, limit = 20): Promise<LifecycleFinanceConfirmRow[]> {
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM crm_lifecycle_finance_confirm
       WHERE lifecycle_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [lifecycleId, limit],
    );
    return result.rows.map((row) => mapLifecycleFinanceConfirmRow(row));
  }
}
