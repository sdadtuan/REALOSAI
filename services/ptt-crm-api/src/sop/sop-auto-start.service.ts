import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { catalogTs } from '../catalog/catalog-slug.util';
import { SopPgRepository } from './sop-pg.repository';
import { SopSqliteRepository } from './sop-sqlite.repository';
import { shouldReuseLifecycleSopRun } from './sop-auto-start.util';

const LAUNCH_TEMPLATE_CODE = 'MKT-LAUNCH-14D';

export interface SopAutoStartResult {
  started: boolean;
  run_id?: number;
  idempotent?: boolean;
  reason?: string;
}

@Injectable()
export class SopAutoStartService implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly sopSqlite: SopSqliteRepository,
    private readonly sopPg: SopPgRepository,
    private readonly config: AppConfigService,
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

  async maybeStartOnLifecyclePromote(input: {
    lifecycleId: number;
    contractId?: number | null;
    customerName?: string;
    serviceSlug?: string;
  }): Promise<SopAutoStartResult> {
    if (!this.config.sopAutoStartOnLaunch) {
      return { started: false, reason: 'PTT_SOP_AUTO_START_ON_LAUNCH disabled' };
    }

    const usePg = this.config.crmSopPg;
    const existingRunId = usePg
      ? await this.getLifecycleSopRunIdPg(input.lifecycleId)
      : this.getLifecycleSopRunIdSqlite(input.lifecycleId);

    const existingRun = existingRunId
      ? usePg
        ? await this.sopPg.getRunById(existingRunId)
        : this.sopSqlite.getRunById(existingRunId)
      : null;

    if (shouldReuseLifecycleSopRun(existingRunId, !!existingRun)) {
      return {
        started: true,
        run_id: existingRunId!,
        idempotent: true,
        reason: 'lifecycle_once',
      };
    }

    const template = usePg
      ? await this.sopPg.getTemplateByCode(LAUNCH_TEMPLATE_CODE)
      : this.sopSqlite.getTemplateByCode(LAUNCH_TEMPLATE_CODE);
    if (!template) {
      return { started: false, reason: `Template ${LAUNCH_TEMPLATE_CODE} not found` };
    }

    const campaignId = input.contractId
      ? usePg
        ? await this.findCampaignForContractPg(input.contractId)
        : this.findCampaignForContractSqlite(input.contractId)
      : null;
    const name = [
      'Launch SOP',
      input.customerName?.trim() || `Lifecycle #${input.lifecycleId}`,
      input.serviceSlug ? `(${input.serviceSlug})` : '',
    ]
      .filter(Boolean)
      .join(' — ')
      .slice(0, 200);

    const run = usePg
      ? await this.sopPg.createRun(
          {
            name,
            template_id: template.id,
            campaign_id: campaignId ?? undefined,
            start_date: catalogTs().slice(0, 10),
            generate_tasks: true,
          },
          true,
        )
      : this.sopSqlite.createRun(
          {
            name,
            template_id: template.id,
            campaign_id: campaignId ?? undefined,
            start_date: catalogTs().slice(0, 10),
            generate_tasks: true,
          },
          true,
        );
    const runId = Number(run.id ?? 0);
    if (!runId) {
      return { started: false, reason: 'Failed to create SOP run' };
    }

    if (usePg) {
      await this.setLifecycleSopRunIdPg(input.lifecycleId, runId);
    } else {
      this.setLifecycleSopRunIdSqlite(input.lifecycleId, runId);
    }
    return { started: true, run_id: runId };
  }

  private async getLifecycleSopRunIdPg(lifecycleId: number): Promise<number | null> {
    try {
      const result = await this.db.query(
        `SELECT sop_run_id FROM crm_service_lifecycle WHERE id = $1 LIMIT 1`,
        [lifecycleId],
      );
      const row = result.rows[0] as { sop_run_id: number | null } | undefined;
      const rid = row?.sop_run_id != null ? Number(row.sop_run_id) : 0;
      return rid > 0 ? rid : null;
    } catch {
      return null;
    }
  }

  private getLifecycleSopRunIdSqlite(lifecycleId: number): number | null {
    try {
      const db = (this.sopSqlite as unknown as { database: import('node:sqlite').DatabaseSync })
        .database;
      const row = db
        .prepare(`SELECT sop_run_id FROM crm_service_lifecycle WHERE id = ? LIMIT 1`)
        .get(lifecycleId) as { sop_run_id: number | null } | undefined;
      const rid = row?.sop_run_id != null ? Number(row.sop_run_id) : 0;
      return rid > 0 ? rid : null;
    } catch {
      return null;
    }
  }

  private async setLifecycleSopRunIdPg(lifecycleId: number, runId: number): Promise<void> {
    await this.db.query(
      `UPDATE crm_service_lifecycle SET sop_run_id = $1, updated_at = $2::timestamptz WHERE id = $3`,
      [runId, catalogTs(), lifecycleId],
    );
  }

  private setLifecycleSopRunIdSqlite(lifecycleId: number, runId: number): void {
    const db = (this.sopSqlite as unknown as { database: import('node:sqlite').DatabaseSync })
      .database;
    db.prepare(
      `UPDATE crm_service_lifecycle SET sop_run_id = ?, updated_at = ? WHERE id = ?`,
    ).run(runId, catalogTs(), lifecycleId);
  }

  private async findCampaignForContractPg(contractId: number): Promise<number | null> {
    try {
      const result = await this.db.query(
        `SELECT campaign_id FROM crm_contracts WHERE id = $1 LIMIT 1`,
        [contractId],
      );
      const row = result.rows[0] as { campaign_id: number | null } | undefined;
      const cid = row?.campaign_id != null ? Number(row.campaign_id) : 0;
      return cid > 0 ? cid : null;
    } catch {
      return null;
    }
  }

  private findCampaignForContractSqlite(contractId: number): number | null {
    try {
      const db = (this.sopSqlite as unknown as { database: import('node:sqlite').DatabaseSync })
        .database;
      const row = db
        .prepare(`SELECT campaign_id FROM crm_contracts WHERE id = ? LIMIT 1`)
        .get(contractId) as { campaign_id: number | null } | undefined;
      const cid = row?.campaign_id != null ? Number(row.campaign_id) : 0;
      return cid > 0 ? cid : null;
    } catch {
      return null;
    }
  }
}
