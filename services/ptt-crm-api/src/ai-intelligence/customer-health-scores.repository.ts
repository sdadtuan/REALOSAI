import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CustomerHealthScoreRecord } from './churn-health.types';

function mapRow(row: Record<string, unknown>): CustomerHealthScoreRecord {
  return {
    id: String(row.id ?? ''),
    client_id: String(row.client_id ?? ''),
    score: Number(row.score ?? 0),
    components_json: (row.components_json as Record<string, unknown>) ?? {},
    ai_score_id: (row.ai_score_id as string | null) ?? null,
    calculated_at: String(row.calculated_at ?? ''),
    created_at: String(row.created_at ?? ''),
  };
}

@Injectable()
export class CustomerHealthScoresRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'customer_health_scores'
         LIMIT 1`,
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async findLatestByClient(clientId: string): Promise<CustomerHealthScoreRecord | null> {
    const result = await this.db.query(
      `SELECT * FROM customer_health_scores
       WHERE client_id = $1::uuid
       ORDER BY calculated_at DESC
       LIMIT 1`,
      [clientId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async wasScoredWithinHours(clientId: string, hours: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM customer_health_scores
       WHERE client_id = $1::uuid
         AND calculated_at >= NOW() - ($2::int * INTERVAL '1 hour')
       LIMIT 1`,
      [clientId, Math.max(1, hours)],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async insert(args: {
    clientId: string;
    score: number;
    components: Record<string, unknown>;
    aiScoreId?: string | null;
  }): Promise<CustomerHealthScoreRecord> {
    const result = await this.db.query(
      `INSERT INTO customer_health_scores (client_id, score, components_json, ai_score_id)
       VALUES ($1::uuid, $2, $3::jsonb, $4::uuid)
       RETURNING *`,
      [args.clientId, args.score, JSON.stringify(args.components), args.aiScoreId ?? null],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async listLatestDashboard(args: {
    ticketSpike?: boolean;
    sort: 'churn_risk' | 'score';
    order: 'asc' | 'desc';
    limit: number;
    offset: number;
  }): Promise<{ rows: CustomerHealthScoreRecord[]; total: number }> {
    const params: unknown[] = [];
    let idx = 1;
    const filters: string[] = [];

    if (args.ticketSpike) {
      filters.push(`COALESCE((l.components_json->>'ticket_spike')::boolean, FALSE) = TRUE`);
    }
    const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const sortColumn = args.sort === 'score' ? 'l.score' : '(100 - l.score)';
    const sortDir = args.order === 'asc' ? 'ASC' : 'DESC';

    const countResult = await this.db.query(
      `WITH latest AS (
         SELECT DISTINCT ON (client_id) *
         FROM customer_health_scores
         ORDER BY client_id, calculated_at DESC
       )
       SELECT COUNT(*)::int AS total FROM latest l ${whereSql}`,
      params,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    const limit = Math.min(Math.max(args.limit, 1), 200);
    const offset = Math.max(args.offset, 0);
    params.push(limit, offset);

    const result = await this.db.query(
      `WITH latest AS (
         SELECT DISTINCT ON (client_id) *
         FROM customer_health_scores
         ORDER BY client_id, calculated_at DESC
       )
       SELECT l.*
       FROM latest l
       ${whereSql}
       ORDER BY ${sortColumn} ${sortDir}, l.client_id ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    return {
      rows: result.rows.map((row) => mapRow(row as Record<string, unknown>)),
      total,
    };
  }
}
