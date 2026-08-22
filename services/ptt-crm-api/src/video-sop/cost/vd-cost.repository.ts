import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';

export type VdCostKind = 'estimated' | 'actual';

export type VdBudgetRow = {
  project_id: number;
  currency: string;
  limit_amount: number;
  buffer_factor: number;
  overshoot_factor: number;
  alert_threshold: number;
  updated_at: string;
};

export type VdCostLedgerRow = {
  id: number;
  project_id: number;
  job_id: number | null;
  kind: VdCostKind;
  amount: number;
  vendor: string;
  created_at: string;
};

type MemoryStore = {
  budgets: VdBudgetRow[];
  ledger: VdCostLedgerRow[];
  nextLedgerId: number;
};

function defaultBudget(projectId: number): VdBudgetRow {
  return {
    project_id: projectId,
    currency: 'USD',
    limit_amount: 100,
    buffer_factor: 1.5,
    overshoot_factor: 2.5,
    alert_threshold: 100,
    updated_at: new Date().toISOString(),
  };
}

@Injectable()
export class VdCostRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = { budgets: [], ledger: [], nextLedgerId: 1 };

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM vd_cost_ledger LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private assertWritableOrThrow(): void {
    if (this.config.contentMarketingVideoCinematicEnabled) {
      throw new Error('vd_tables_missing');
    }
  }

  private mapBudget(row: Record<string, unknown>): VdBudgetRow {
    return {
      project_id: Number(row.project_id),
      currency: String(row.currency ?? 'USD'),
      limit_amount: Number(row.limit_amount ?? 100),
      buffer_factor: Number(row.buffer_factor ?? 1.5),
      overshoot_factor: Number(row.overshoot_factor ?? 2.5),
      alert_threshold: Number(row.alert_threshold ?? 100),
      updated_at: String(row.updated_at ?? new Date().toISOString()),
    };
  }

  private mapLedger(row: Record<string, unknown>): VdCostLedgerRow {
    const jobId = row.job_id;
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      job_id: jobId == null ? null : Number(jobId),
      kind: String(row.kind) as VdCostKind,
      amount: Number(row.amount),
      vendor: String(row.vendor ?? ''),
      created_at: String(row.created_at ?? new Date().toISOString()),
    };
  }

  async getBudget(projectId: number): Promise<VdBudgetRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT project_id, currency, limit_amount, buffer_factor, overshoot_factor, alert_threshold, updated_at
         FROM vd_budgets WHERE project_id = $1`,
        [projectId],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapBudget(row) : defaultBudget(projectId);
    }
    return this.memory.budgets.find((b) => b.project_id === projectId) ?? defaultBudget(projectId);
  }

  async upsertBudget(
    projectId: number,
    input: Partial<
      Pick<VdBudgetRow, 'limit_amount' | 'buffer_factor' | 'overshoot_factor' | 'alert_threshold' | 'currency'>
    >,
  ): Promise<VdBudgetRow> {
    const current = await this.getBudget(projectId);
    const next: VdBudgetRow = {
      ...current,
      ...(input.limit_amount != null ? { limit_amount: input.limit_amount } : {}),
      ...(input.buffer_factor != null ? { buffer_factor: input.buffer_factor } : {}),
      ...(input.overshoot_factor != null ? { overshoot_factor: input.overshoot_factor } : {}),
      ...(input.alert_threshold != null ? { alert_threshold: input.alert_threshold } : {}),
      ...(input.currency != null ? { currency: input.currency } : {}),
      updated_at: new Date().toISOString(),
    };

    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_budgets (project_id, currency, limit_amount, buffer_factor, overshoot_factor, alert_threshold, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (project_id) DO UPDATE SET
           currency = EXCLUDED.currency,
           limit_amount = EXCLUDED.limit_amount,
           buffer_factor = EXCLUDED.buffer_factor,
           overshoot_factor = EXCLUDED.overshoot_factor,
           alert_threshold = EXCLUDED.alert_threshold,
           updated_at = now()
         RETURNING project_id, currency, limit_amount, buffer_factor, overshoot_factor, alert_threshold, updated_at`,
        [
          projectId,
          next.currency,
          next.limit_amount,
          next.buffer_factor,
          next.overshoot_factor,
          next.alert_threshold,
        ],
      );
      return this.mapBudget(res.rows[0] as Record<string, unknown>);
    }

    this.assertWritableOrThrow();
    const idx = this.memory.budgets.findIndex((b) => b.project_id === projectId);
    if (idx >= 0) this.memory.budgets[idx] = next;
    else this.memory.budgets.push(next);
    return next;
  }

  async insertLedger(input: {
    project_id: number;
    job_id?: number | null;
    kind: VdCostKind;
    amount: number;
    vendor?: string;
  }): Promise<VdCostLedgerRow> {
    const vendor = input.vendor ?? '';
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_cost_ledger (project_id, job_id, kind, amount, vendor)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, project_id, job_id, kind, amount, vendor, created_at`,
        [input.project_id, input.job_id ?? null, input.kind, input.amount, vendor],
      );
      return this.mapLedger(res.rows[0] as Record<string, unknown>);
    }
    this.assertWritableOrThrow();
    const row: VdCostLedgerRow = {
      id: this.memory.nextLedgerId++,
      project_id: input.project_id,
      job_id: input.job_id ?? null,
      kind: input.kind,
      amount: input.amount,
      vendor,
      created_at: new Date().toISOString(),
    };
    this.memory.ledger.push(row);
    return row;
  }

  async listLedger(projectId: number, limit = 200): Promise<VdCostLedgerRow[]> {
    const cap = Math.max(1, Math.min(limit, 500));
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, project_id, job_id, kind, amount, vendor, created_at
         FROM vd_cost_ledger WHERE project_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        [projectId, cap],
      );
      return (res.rows as Record<string, unknown>[]).map((row) => this.mapLedger(row));
    }
    return this.memory.ledger
      .filter((row) => row.project_id === projectId)
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, cap);
  }

  async sumByKind(projectId: number, kind: VdCostKind): Promise<number> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM vd_cost_ledger WHERE project_id = $1 AND kind = $2`,
        [projectId, kind],
      );
      return Number((res.rows[0] as { total?: unknown }).total ?? 0);
    }
    return this.memory.ledger
      .filter((row) => row.project_id === projectId && row.kind === kind)
      .reduce((sum, row) => sum + row.amount, 0);
  }
}
