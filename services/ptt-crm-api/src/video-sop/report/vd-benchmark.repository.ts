import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type { VdProductionMetric } from './vd-report-metrics';

export type VdBenchmarkRow = {
  id: number;
  project_id: number;
  metric: VdProductionMetric;
  value: number;
  computed_at: string;
};

type MemoryStore = {
  rows: VdBenchmarkRow[];
  nextId: number;
};

@Injectable()
export class VdBenchmarkRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = { rows: [], nextId: 1 };

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
      await this.db.query(`SELECT 1 FROM vd_benchmarks LIMIT 1`);
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

  async insert(input: {
    project_id: number;
    metric: VdProductionMetric;
    value: number;
  }): Promise<VdBenchmarkRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_benchmarks (project_id, metric, value)
         VALUES ($1, $2, $3)
         RETURNING id, project_id, metric, value, computed_at`,
        [input.project_id, input.metric, input.value],
      );
      const row = res.rows[0] as Record<string, unknown>;
      return {
        id: Number(row.id),
        project_id: Number(row.project_id),
        metric: String(row.metric) as VdProductionMetric,
        value: Number(row.value),
        computed_at: new Date(String(row.computed_at)).toISOString(),
      };
    }
    this.assertWritableOrThrow();
    const row: VdBenchmarkRow = {
      id: this.memory.nextId++,
      project_id: input.project_id,
      metric: input.metric,
      value: input.value,
      computed_at: new Date().toISOString(),
    };
    this.memory.rows.push(row);
    return row;
  }
}
