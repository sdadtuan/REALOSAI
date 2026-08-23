import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { TERMINAL_STAGES } from '../sales/sales-pipeline.util';
import { DealScoreContext } from './deal-score.types';

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class DealScoreContextRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly crmConfig: CrmConfigService,
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

  async loadDealScoreContext(dealId: number): Promise<DealScoreContext | null> {
    const caseResult = await this.db.query(
      `SELECT c.id AS pg_id,
              COALESCE(c.sqlite_case_id, c.id) AS legacy_id,
              c.title, c.pipeline_stage, c.stage_entered_at, c.updated_at, c.status,
              COALESCE(c.deal_value_vnd, 0) AS deal_value_vnd
       FROM crm_cases c
       WHERE c.sqlite_case_id = $1 OR c.id = $1
       ORDER BY CASE WHEN c.sqlite_case_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [dealId],
    );
    const row = caseResult.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;

    const pgCaseId = Number(row.pg_id);
    const legacyId = Number(row.legacy_id ?? dealId);
    const runtime = await this.crmConfig.resolvePipelineRuntime();
    const stage = String(row.pipeline_stage ?? 'moi');

    const eventResult = await this.db.query(
      `SELECT COUNT(*)::bigint AS n7,
              MAX(created_at) AS last_at
       FROM crm_case_events
       WHERE case_id = $1
         AND created_at >= NOW() - INTERVAL '7 days'`,
      [pgCaseId],
    );
    const eventRow = eventResult.rows[0] as { n7?: string; last_at?: unknown } | undefined;

    const stageEnteredAt = parseDate(row.stage_entered_at) ?? parseDate(row.updated_at) ?? new Date();
    const updatedAt = parseDate(row.updated_at) ?? stageEnteredAt;

    return {
      dealId: legacyId,
      clientId: null,
      title: String(row.title ?? ''),
      pipelineStage: stage,
      isTerminal: runtime.terminalStages.has(stage) || TERMINAL_STAGES.has(stage),
      dealValueVnd: Number(row.deal_value_vnd ?? 0),
      stageEnteredAt,
      updatedAt,
      lastActivityAt: parseDate(eventRow?.last_at),
      activityCount7d: Number(eventRow?.n7 ?? 0),
      status: String(row.status ?? ''),
    };
  }

  async listOpenDealIds(limit = 200): Promise<number[]> {
    const runtime = await this.crmConfig.resolvePipelineRuntime();
    const terminal = [...new Set([...runtime.terminalStages, ...TERMINAL_STAGES])];
    const capped = Math.min(Math.max(limit, 1), 500);
    const result = await this.db.query(
      `SELECT COALESCE(c.sqlite_case_id, c.id) AS id
       FROM crm_cases c
       WHERE COALESCE(c.pipeline_stage, 'moi') NOT IN (SELECT unnest($1::text[]))
       ORDER BY c.updated_at DESC, c.id DESC
       LIMIT $2`,
      [terminal, capped],
    );
    return (result.rows as Array<{ id: string | number }>)
      .map((r) => Number(r.id))
      .filter((id) => Number.isFinite(id) && id > 0);
  }
}
