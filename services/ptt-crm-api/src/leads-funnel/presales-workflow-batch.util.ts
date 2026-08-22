import { PRESALES_STAGES, PresalesStage } from './leads-funnel.types';
import { normalizeUpgradeStages } from './presales-workflow-upgrade.util';

/** Consult tasks with fewer fields than service template need upgrade (generic = 1 field). */
export const PRESALES_UPGRADE_CONSULT_FIELD_MIN = 4;

export const PRESALES_BATCH_UPGRADE_MAX = 50;

export interface PresalesWorkflowUpgradeCohortRow {
  lead_id: number;
  presales_id: number;
  service_slug: string;
  stage: string;
  consult_field_keys: string[];
}

export interface BatchUpgradePresalesWorkflowResult {
  ok: boolean;
  dry_run: boolean;
  cohort_size: number;
  processed: number;
  upgraded: number;
  skipped: number;
  results: Array<{
    lead_id: number;
    ok: boolean;
    service_slug?: string;
    error?: string;
    stages?: Array<{
      stage: string;
      deleted: number;
      inserted: number;
      preserved_done: boolean;
      mapped_fields: string[];
    }>;
  }>;
  csv_rows: string[];
}

export function needsPresalesWorkflowUpgrade(consultFieldCount: number): boolean {
  return consultFieldCount < PRESALES_UPGRADE_CONSULT_FIELD_MIN;
}

export function capBatchLeadIds(leadIds: number[], limit?: number): number[] {
  const max = Math.min(
    PRESALES_BATCH_UPGRADE_MAX,
    limit != null && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : PRESALES_BATCH_UPGRADE_MAX,
  );
  const unique = [...new Set(leadIds.filter((id) => Number.isFinite(id) && id > 0))];
  return unique.slice(0, max);
}

export function cohortCsvRow(row: PresalesWorkflowUpgradeCohortRow): string {
  const keys = row.consult_field_keys.join('|');
  return `${row.lead_id},${row.service_slug},${keys}`;
}

export function buildBatchUpgradeCsvHeader(): string {
  return 'lead_id,service_slug,old_field_keys';
}

export function resolveBatchUpgradeStages(stages?: PresalesStage[]): PresalesStage[] {
  return normalizeUpgradeStages(stages);
}

export function emptyBatchUpgradeResult(dryRun: boolean): BatchUpgradePresalesWorkflowResult {
  return {
    ok: true,
    dry_run: dryRun,
    cohort_size: 0,
    processed: 0,
    upgraded: 0,
    skipped: 0,
    results: [],
    csv_rows: [buildBatchUpgradeCsvHeader()],
  };
}

/** Active presales stages eligible for template batch upgrade. */
export const PRESALES_BATCH_UPGRADE_STAGES = PRESALES_STAGES;
