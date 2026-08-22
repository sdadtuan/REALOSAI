import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';

export type VdTakeVerdict = 'passed' | 'failed';

export type VdTakeScoreRow = {
  id: number;
  asset_id: number;
  shot_id: number;
  verdict: VdTakeVerdict;
  artifact_json: Record<string, unknown>;
  created_at: string;
};

export type VdBudgetRow = {
  project_id: number;
  alert_threshold: number;
};

type MemoryStore = {
  scores: VdTakeScoreRow[];
  budgets: VdBudgetRow[];
  nextId: number;
};

@Injectable()
export class VdTakeRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = { scores: [], budgets: [], nextId: 1 };

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
      await this.db.query(`SELECT 1 FROM vd_take_scores LIMIT 1`);
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

  private mapScore(row: Record<string, unknown>): VdTakeScoreRow {
    const artifact = row.artifact_json;
    return {
      id: Number(row.id),
      asset_id: Number(row.asset_id),
      shot_id: Number(row.shot_id),
      verdict: String(row.verdict) as VdTakeVerdict,
      artifact_json:
        artifact && typeof artifact === 'object' && !Array.isArray(artifact)
          ? (artifact as Record<string, unknown>)
          : {},
      created_at: String(row.created_at ?? new Date().toISOString()),
    };
  }

  async insertScore(input: {
    asset_id: number;
    shot_id: number;
    verdict: VdTakeVerdict;
    artifact_json?: Record<string, unknown>;
  }): Promise<VdTakeScoreRow> {
    const artifact = input.artifact_json ?? {};
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_take_scores (asset_id, shot_id, verdict, artifact_json)
         VALUES ($1, $2, $3, $4)
         RETURNING id, asset_id, shot_id, verdict, artifact_json, created_at`,
        [input.asset_id, input.shot_id, input.verdict, JSON.stringify(artifact)],
      );
      return this.mapScore(res.rows[0] as Record<string, unknown>);
    }
    this.assertWritableOrThrow();
    const row: VdTakeScoreRow = {
      id: this.memory.nextId++,
      asset_id: input.asset_id,
      shot_id: input.shot_id,
      verdict: input.verdict,
      artifact_json: artifact,
      created_at: new Date().toISOString(),
    };
    this.memory.scores.push(row);
    return row;
  }

  async listByProjectId(projectId: number): Promise<VdTakeScoreRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT ts.id, ts.asset_id, ts.shot_id, ts.verdict, ts.artifact_json, ts.created_at
         FROM vd_take_scores ts
         INNER JOIN vd_assets a ON a.id = ts.asset_id
         WHERE a.project_id = $1
         ORDER BY ts.created_at DESC`,
        [projectId],
      );
      return (res.rows as Record<string, unknown>[]).map((row) => this.mapScore(row));
    }
    return this.memory.scores.slice();
  }

  async hasPassedDraftForShot(shotId: number): Promise<boolean> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT 1 FROM vd_take_scores WHERE shot_id = $1 AND verdict = 'passed' LIMIT 1`,
        [shotId],
      );
      return res.rowCount != null && res.rowCount > 0;
    }
    return this.memory.scores.some((row) => row.shot_id === shotId && row.verdict === 'passed');
  }

  async getBudget(projectId: number): Promise<VdBudgetRow> {
    const fallback = { project_id: projectId, alert_threshold: 100 };
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT project_id, alert_threshold FROM vd_budgets WHERE project_id = $1`,
        [projectId],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      if (!row) return fallback;
      return {
        project_id: Number(row.project_id),
        alert_threshold: Number(row.alert_threshold ?? 100),
      };
    }
    return this.memory.budgets.find((row) => row.project_id === projectId) ?? fallback;
  }
}
