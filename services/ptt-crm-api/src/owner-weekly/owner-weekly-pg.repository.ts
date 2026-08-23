import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { buildOwnerWeeklyExportSheets, ownerWeeklyExportFilename } from './owner-weekly-export.util';
import {
  deleteCashSnapshotPg,
  getOwnerWeeklyDashboardPg,
  getOwnerWeeklyInboxSummaryPg,
  getOwnerWeeklyTargetsPg,
  listCashSnapshotsPg,
  setOwnerWeeklyTargetsPg,
  syncOwnerWeeklyInboxStubPg,
  upsertCashSnapshotPg,
} from './owner-weekly-pg.util';
import {
  OWNER_WEEKLY_ENV_KEYS,
  OWNER_WEEKLY_TARGET_DEFAULTS,
  OWNER_WEEKLY_TARGET_GROUPS,
  OWNER_WEEKLY_TARGET_LABELS,
  resolveWeekBounds,
} from './owner-weekly.util';

@Injectable()
export class OwnerWeeklyPgRepository implements OnModuleDestroy {
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

  async dashboard(opts: {
    weekEnd?: string | null;
    year?: number | null;
    isoWeek?: number | null;
    trendWeeks?: number;
  }): Promise<Record<string, unknown>> {
    return getOwnerWeeklyDashboardPg(this.db, opts);
  }

  async configGet(): Promise<Record<string, unknown>> {
    return {
      targets: await getOwnerWeeklyTargetsPg(this.db),
      defaults: OWNER_WEEKLY_TARGET_DEFAULTS,
      labels: OWNER_WEEKLY_TARGET_LABELS,
      env_keys: OWNER_WEEKLY_ENV_KEYS,
      target_groups: OWNER_WEEKLY_TARGET_GROUPS,
    };
  }

  async configPatch(updates: Record<string, unknown>): Promise<Record<string, unknown>> {
    return { ok: true, targets: await setOwnerWeeklyTargetsPg(this.db, updates) };
  }

  async listCashSnapshots(limit: number): Promise<Record<string, unknown>> {
    return { snapshots: await listCashSnapshotsPg(this.db, limit) };
  }

  async upsertCashSnapshot(
    snapshotOn: string,
    balanceVnd: number,
    source: string,
    notes: string,
  ): Promise<Record<string, unknown>> {
    const row = await upsertCashSnapshotPg(this.db, snapshotOn, balanceVnd, source, notes);
    return { ok: true, snapshot: row };
  }

  async deleteCashSnapshot(snapshotOn: string): Promise<Record<string, unknown>> {
    const deleted = await deleteCashSnapshotPg(this.db, snapshotOn);
    return { ok: true, deleted };
  }

  async export(opts: {
    weekEnd?: string | null;
    year?: number | null;
    isoWeek?: number | null;
  }): Promise<Record<string, unknown>> {
    const dashboard = await getOwnerWeeklyDashboardPg(this.db, opts);
    const sheets = buildOwnerWeeklyExportSheets(dashboard);
    return {
      filename: ownerWeeklyExportFilename(dashboard),
      format: 'json',
      sheets,
    };
  }

  async alertCron(isoYear?: number | null, isoWeek?: number | null): Promise<Record<string, unknown>> {
    const y = isoYear != null && isoWeek != null ? isoYear : resolveWeekBounds({}).isoYear;
    const w = isoYear != null && isoWeek != null ? isoWeek : resolveWeekBounds({}).isoWeek;
    const dashboard = await getOwnerWeeklyDashboardPg(this.db, { year: y, isoWeek: w });
    const brief = dashboard.pre_execution as Record<string, unknown>;
    return {
      ok: true,
      stub: true,
      iso_year: y,
      iso_week: w,
      red_count: brief.red_count ?? 0,
      yellow_count: brief.yellow_count ?? 0,
    };
  }

  async inboxSync(isoYear?: number | null, isoWeek?: number | null): Promise<Record<string, unknown>> {
    const y = isoYear != null && isoWeek != null ? isoYear : resolveWeekBounds({}).isoYear;
    const w = isoYear != null && isoWeek != null ? isoWeek : resolveWeekBounds({}).isoWeek;
    const dashboard = await getOwnerWeeklyDashboardPg(this.db, { year: y, isoWeek: w });
    return { ok: true, inbox: await syncOwnerWeeklyInboxStubPg(this.db, y, w, dashboard) };
  }

  async inboxSummary(): Promise<Record<string, unknown>> {
    return getOwnerWeeklyInboxSummaryPg(this.db);
  }
}
