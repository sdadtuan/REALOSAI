import { Injectable } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
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
export class DealScoreContextRepository {
  private db: DatabaseSync | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly crmConfig: CrmConfigService,
  ) {}

  private get database(): DatabaseSync {
    if (!this.db) {
      this.db = new DatabaseSync(this.config.sqlitePath);
      this.db.exec('PRAGMA foreign_keys = ON');
    }
    return this.db;
  }

  loadDealScoreContext(dealId: number): DealScoreContext | null {
    const row = this.database
      .prepare(
        `SELECT c.id, c.title, c.pipeline_stage, c.stage_entered_at, c.updated_at, c.status,
                COALESCE(c.deal_value_vnd, 0) AS deal_value_vnd
         FROM crm_cases c
         WHERE c.id = ?`,
      )
      .get(dealId) as Record<string, unknown> | undefined;
    if (!row) return null;

    const runtime = this.crmConfig.toPipelineRuntime();
    const stage = String(row.pipeline_stage ?? 'moi');
    const eventRow = this.database
      .prepare(
        `SELECT COUNT(*) AS n7,
                MAX(created_at) AS last_at
         FROM crm_case_events
         WHERE case_id = ?
           AND datetime(created_at) >= datetime('now', '-7 days')`,
      )
      .get(dealId) as { n7?: number; last_at?: string } | undefined;

    const stageEnteredAt = parseDate(row.stage_entered_at) ?? parseDate(row.updated_at) ?? new Date();
    const updatedAt = parseDate(row.updated_at) ?? stageEnteredAt;

    return {
      dealId,
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

  listOpenDealIds(limit = 200): number[] {
    const runtime = this.crmConfig.toPipelineRuntime();
    const terminal = [...runtime.terminalStages, ...TERMINAL_STAGES];
    const placeholders = terminal.map(() => '?').join(',');
    const capped = Math.min(Math.max(limit, 1), 500);
    const rows = this.database
      .prepare(
        `SELECT c.id
         FROM crm_cases c
         WHERE COALESCE(c.pipeline_stage, 'moi') NOT IN (${placeholders})
         ORDER BY c.updated_at DESC, c.id DESC
         LIMIT ?`,
      )
      .all(...terminal, capped) as Array<{ id: number }>;
    return rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id) && id > 0);
  }
}
