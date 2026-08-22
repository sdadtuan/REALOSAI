import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { RoutingAbBucket } from './b2b-routing-ab.util';

@Injectable()
export class B2bRoutingAbRepository implements OnModuleDestroy {
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
    const result = await this.db.query(
      `SELECT to_regclass('public.crm_b2b_routing_ab') AS reg`,
    );
    return result.rows[0]?.reg != null;
  }

  async upsertFirstAssign(input: {
    leadId: number;
    bucket: RoutingAbBucket;
    strategy: 'ai_analytics' | 'hybrid' | 'hybrid_timeout';
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_b2b_routing_ab (lead_id, bucket, strategy)
       VALUES ($1, $2, $3)
       ON CONFLICT (lead_id) DO UPDATE
         SET bucket = EXCLUDED.bucket,
             strategy = EXCLUDED.strategy
       WHERE crm_b2b_routing_ab.won IS NULL`,
      [input.leadId, input.bucket, input.strategy],
    );
  }

  async recordOutcome(input: { leadId: number; won: boolean }): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE crm_b2b_routing_ab
       SET won = $2,
           resolved_at = NOW()
       WHERE lead_id = $1
         AND won IS NULL
       RETURNING lead_id`,
      [input.leadId, input.won],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async loadReport(days: number): Promise<{
    ai_win_rate: number | null;
    hybrid_win_rate: number | null;
    n: number;
  }> {
    const result = await this.db.query(
      `SELECT
         strategy,
         COUNT(*) FILTER (WHERE won IS NOT NULL)::int AS resolved,
         COUNT(*) FILTER (WHERE won = TRUE)::int AS wins
       FROM crm_b2b_routing_ab
       WHERE created_at >= NOW() - ($1::int || ' days')::interval
       GROUP BY strategy`,
      [Math.max(1, days)],
    );

    let aiResolved = 0;
    let aiWins = 0;
    let hybridResolved = 0;
    let hybridWins = 0;

    for (const row of result.rows) {
      const strategy = String(row.strategy);
      const resolved = Number(row.resolved ?? 0);
      const wins = Number(row.wins ?? 0);
      if (strategy === 'ai_analytics') {
        aiResolved = resolved;
        aiWins = wins;
      } else {
        hybridResolved += resolved;
        hybridWins += wins;
      }
    }

    const n = aiResolved + hybridResolved;
    return {
      ai_win_rate: aiResolved > 0 ? Math.round((aiWins / aiResolved) * 1000) / 1000 : null,
      hybrid_win_rate:
        hybridResolved > 0 ? Math.round((hybridWins / hybridResolved) * 1000) / 1000 : null,
      n,
    };
  }
}
