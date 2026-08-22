import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { RevenueForecastSnapshotRecord } from './forecast.types';

function mapRow(row: Record<string, unknown>): RevenueForecastSnapshotRecord {
  return {
    id: String(row.id ?? ''),
    snapshot_date: String(row.snapshot_date ?? '').slice(0, 10),
    pipeline_amount: Number(row.pipeline_amount ?? 0),
    forecast_amount: Number(row.forecast_amount ?? 0),
    ai_adjustment: row.ai_adjustment != null ? Number(row.ai_adjustment) : null,
    best_case_amount: Number(row.best_case_amount ?? 0),
    committed_amount: Number(row.committed_amount ?? 0),
    confidence_score: row.confidence_score != null ? Number(row.confidence_score) : null,
    committed_by: (row.committed_by as string | null) ?? null,
    committed_at: row.committed_at != null ? String(row.committed_at) : null,
    agent_run_id: (row.agent_run_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? ''),
  };
}

@Injectable()
export class RevenueForecastRepository implements OnModuleDestroy {
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

  async tableReady(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'revenue_forecast_snapshots'
         LIMIT 1`,
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async deleteUncommittedOrgSnapshotForDate(snapshotDate: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM revenue_forecast_snapshots
       WHERE snapshot_date = $1::date
         AND client_id IS NULL
         AND COALESCE(owner_user_id, '') = ''
         AND COALESCE(team_id, '') = ''
         AND committed_at IS NULL`,
      [snapshotDate],
    );
    return result.rowCount ?? 0;
  }

  async findBySnapshotDate(snapshotDate: string): Promise<RevenueForecastSnapshotRecord | null> {
    const result = await this.db.query(
      `SELECT *
       FROM revenue_forecast_snapshots
       WHERE snapshot_date = $1::date
         AND client_id IS NULL
         AND COALESCE(owner_user_id, '') = ''
         AND COALESCE(team_id, '') = ''
       ORDER BY created_at DESC
       LIMIT 1`,
      [snapshotDate],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async findLatestInMonth(year: number, month: number): Promise<RevenueForecastSnapshotRecord | null> {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    const result = await this.db.query(
      `SELECT *
       FROM revenue_forecast_snapshots
       WHERE snapshot_date >= $1::date
         AND snapshot_date <= $2::date
         AND client_id IS NULL
         AND COALESCE(owner_user_id, '') = ''
         AND COALESCE(team_id, '') = ''
       ORDER BY snapshot_date DESC, created_at DESC
       LIMIT 1`,
      [start, end],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async findCommittedForMonth(year: number, month: number): Promise<RevenueForecastSnapshotRecord | null> {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    const result = await this.db.query(
      `SELECT *
       FROM revenue_forecast_snapshots
       WHERE snapshot_date >= $1::date
         AND snapshot_date <= $2::date
         AND client_id IS NULL
         AND committed_at IS NOT NULL
         AND COALESCE(owner_user_id, '') = ''
         AND COALESCE(team_id, '') = ''
       ORDER BY committed_at DESC
       LIMIT 1`,
      [start, end],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async insertSnapshot(args: {
    snapshotDate: string;
    pipelineAmount: number;
    forecastAmount: number;
    aiAdjustment: number;
    bestCaseAmount: number;
    confidenceScore: number;
    metadata: Record<string, unknown>;
    agentRunId: string | null;
  }): Promise<RevenueForecastSnapshotRecord> {
    const result = await this.db.query(
      `INSERT INTO revenue_forecast_snapshots (
         snapshot_date, pipeline_amount, forecast_amount, ai_adjustment,
         best_case_amount, confidence_score, metadata, agent_run_id
       ) VALUES (
         $1::date, $2, $3, $4, $5, $6, $7::jsonb, $8::uuid
       )
       RETURNING *`,
      [
        args.snapshotDate,
        args.pipelineAmount,
        args.forecastAmount,
        args.aiAdjustment,
        args.bestCaseAmount,
        args.confidenceScore,
        JSON.stringify(args.metadata),
        args.agentRunId,
      ],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async commitSnapshot(args: {
    snapshotId: string;
    committedAmount: number;
    committedBy: string;
  }): Promise<RevenueForecastSnapshotRecord | null> {
    const result = await this.db.query(
      `UPDATE revenue_forecast_snapshots
       SET committed_amount = $2,
           committed_by = $3,
           committed_at = NOW()
       WHERE id = $1::uuid
         AND committed_at IS NULL
       RETURNING *`,
      [args.snapshotId, args.committedAmount, args.committedBy],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }
}
