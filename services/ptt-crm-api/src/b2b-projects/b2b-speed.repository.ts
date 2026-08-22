import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export interface B2bSpeedRow {
  lead_id: number;
  owner_id: number | null;
  score: number | null;
  received_at: string;
  first_touch_at: string | null;
}

@Injectable()
export class B2bSpeedRepository implements OnModuleDestroy {
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

  async loadSpeedRows(input: { projectId: string; days: number }): Promise<B2bSpeedRow[]> {
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS lead_id,
              l.owner_id,
              COALESCE((l.meta_json->>'lead_score')::numeric, NULL) AS score,
              COALESCE(l.received_at, l.created_at)::text AS received_at,
              (
                SELECT MIN(c.created_at)::text
                FROM crm_b2b_call_sessions c
                WHERE c.lead_id = l.sqlite_lead_id
                  AND c.kind = 'human'
                  AND c.state IN ('answered', 'ringing')
              ) AS first_touch_at
       FROM crm_leads l
       WHERE l.b2b_project_id = $1::uuid
         AND COALESCE(l.is_duplicate, FALSE) IS NOT TRUE
         AND COALESCE(l.received_at, l.created_at) >= NOW() - ($2::int || ' days')::interval
       ORDER BY l.received_at DESC
       LIMIT 5000`,
      [input.projectId, input.days],
    );
    return result.rows.map((row) => ({
      lead_id: Number(row.lead_id),
      owner_id: row.owner_id != null ? Number(row.owner_id) : null,
      score: row.score != null ? Number(row.score) : null,
      received_at: String(row.received_at),
      first_touch_at: row.first_touch_at ? String(row.first_touch_at) : null,
    }));
  }
}
