import {
  buildScoreLatencyMetrics,
  type ScoreLatencyMetrics,
} from './ai-score-latency.util';
import { AiAgentRunsRepository } from './ai-agent-runs.repository';
import { AiAuditService } from './ai-audit.service';
import { AiScoresRepository } from './ai-scores.repository';
import { AppConfigService } from '../config/app-config.service';
import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class AiScoreLatencyService implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly scores: AiScoresRepository,
    private readonly runs: AiAgentRunsRepository,
    private readonly audit: AiAuditService,
  ) {}

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

  async getScoreLatencyMetrics(windowDays = 7): Promise<{ ok: boolean; data: ScoreLatencyMetrics }> {
    const days = Math.max(1, Math.min(windowDays, 90));

    if (!(await this.scores.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_scores_not_ready',
        message: 'Apply RNOS-01 DDL before score latency metrics',
      });
    }

    const result = await this.db.query(
      `SELECT
         COUNT(*)::int AS scored_leads,
         COUNT(*) FILTER (WHERE latency_sec <= 30)::int AS within_30s,
         COALESCE(
           PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_sec),
           0
         ) AS p95_sec
       FROM (
         SELECT EXTRACT(EPOCH FROM (s.calculated_at - l.created_at)) AS latency_sec
         FROM crm_leads l
         INNER JOIN ai_scores s
           ON s.entity_type = 'lead'
          AND s.entity_id = l.sqlite_lead_id::text
          AND s.overridden_by IS NULL
         WHERE l.created_at >= NOW() - ($1::int * INTERVAL '1 day')
           AND l.is_duplicate IS NOT TRUE
       ) t`,
      [days],
    );

    const row = result.rows[0] as {
      scored_leads: number;
      within_30s: number;
      p95_sec: number;
    };

    let agentRunsP95Ms: number | null = null;
    if (await this.runs.tableReady()) {
      const runResult = await this.db.query(
        `SELECT COALESCE(
           PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms),
           0
         ) AS p95_ms
         FROM ai_agent_runs
         WHERE started_at >= NOW() - ($1::int * INTERVAL '1 day')
           AND use_case = 'score_lead'
           AND status = 'completed'
           AND latency_ms IS NOT NULL`,
        [days],
      );
      const p95 = Number(runResult.rows[0]?.p95_ms ?? 0);
      agentRunsP95Ms = p95 > 0 ? Math.round(p95) : null;
    }

    const data = buildScoreLatencyMetrics({
      windowDays: days,
      scoredLeads: Number(row.scored_leads ?? 0),
      within30s: Number(row.within_30s ?? 0),
      p95Sec: Number(row.p95_sec ?? 0),
      agentRunsP95Ms,
    });

    return { ok: true, data };
  }

  newRequestId(): string {
    return this.audit.newRequestId();
  }
}
