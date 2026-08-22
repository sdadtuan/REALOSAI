import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class B2bOpsSummaryRepository implements OnModuleDestroy {
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

  async loadSummary(input: { projectId?: string }): Promise<{
    unmatched_24h: number;
    hop_ge_2: number;
    sla_breach: number;
    cpaas_fail_24h: number;
  }> {
    const projectFilter = input.projectId?.trim()
      ? ` AND l.b2b_project_id = $1::uuid`
      : '';
    const params = input.projectId?.trim() ? [input.projectId.trim()] : [];

    const unmatched = await this.db.query(
      `SELECT COUNT(*)::int AS n
       FROM crm_b2b_unmatched_ingress
       WHERE created_at >= NOW() - interval '24 hours'`,
    );

    const hop = await this.db.query(
      `SELECT COUNT(*)::int AS n
       FROM (
         SELECT h.lead_id
         FROM crm_b2b_lead_hops h
         JOIN crm_leads l ON l.sqlite_lead_id = h.lead_id
         WHERE COALESCE(l.is_duplicate, FALSE) IS NOT TRUE${projectFilter}
         GROUP BY h.lead_id
         HAVING COUNT(*) >= 2
       ) t`,
      params,
    );

    const sla = await this.db.query(
      `SELECT COUNT(*)::int AS n
       FROM crm_leads l
       WHERE COALESCE(l.is_duplicate, FALSE) IS NOT TRUE
         AND l.b2b_project_id IS NOT NULL
         AND COALESCE(l.meta_json->>'b2b_gdkd_queue', 'false') = 'true'${projectFilter}`,
      params,
    );

    const cpaas = await this.db.query(
      `SELECT COUNT(*)::int AS n
       FROM crm_b2b_call_sessions c
       JOIN crm_leads l ON l.sqlite_lead_id = c.lead_id
       WHERE c.kind = 'human'
         AND c.state = 'no_answer'
         AND c.created_at >= NOW() - interval '24 hours'${projectFilter}`,
      params,
    );

    return {
      unmatched_24h: Number(unmatched.rows[0]?.n ?? 0),
      hop_ge_2: Number(hop.rows[0]?.n ?? 0),
      sla_breach: Number(sla.rows[0]?.n ?? 0),
      cpaas_fail_24h: Number(cpaas.rows[0]?.n ?? 0),
    };
  }
}
