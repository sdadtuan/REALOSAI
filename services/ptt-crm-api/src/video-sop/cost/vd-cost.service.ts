import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { AppConfigService } from '../../config/app-config.service';
import { VdProjectRepository } from '../project/vd-project.repository';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdCostRepository, type VdBudgetRow, type VdCostLedgerRow } from './vd-cost.repository';

export type VdCostWarnings = {
  warn70: boolean;
  warn90: boolean;
  warn100: boolean;
};

export type VdBudgetView = VdBudgetRow & {
  estimated_total: number;
  actual_total: number;
  warnings: VdCostWarnings;
};

export type VdCostsView = {
  project_id: number;
  budget: VdBudgetView;
  items: VdCostLedgerRow[];
};

export type ProviderJobState = {
  provider_code: string;
  status?: string;
  apiCreditCost?: number;
  cost?: { credits?: number };
  estimatedCost?: { credits?: number };
  credits?: number;
  estimates?: { cost?: number };
};

export function actualFromJobState(state: ProviderJobState): number | null {
  switch (state.provider_code) {
    case 'leonardo':
      return typeof state.apiCreditCost === 'number' ? state.apiCreditCost : null;
    case 'runway':
      if (state.status === 'SUCCEEDED' && typeof state.cost?.credits === 'number') {
        return state.cost.credits;
      }
      if (typeof state.estimatedCost?.credits === 'number') {
        return state.estimatedCost.credits;
      }
      return null;
    case 'topaz':
      if (typeof state.credits === 'number') return state.credits;
      if (typeof state.estimates?.cost === 'number') return state.estimates.cost;
      return null;
    default:
      return null;
  }
}

export function reconcileWithinTolerance(
  estimated: number,
  actual: number,
  toleranceRatio = 0.02,
): boolean {
  if (estimated <= 0) return actual <= 0;
  return Math.abs(actual - estimated) / estimated <= toleranceRatio;
}

const IMAGE_CREDIT = 3;
const DRAFT_CREDIT_PER_SEC = 2;
const FINAL_CREDIT_PER_SEC = 5;
const ENHANCE_CREDIT = 10;

function reserveQueues(): Set<string> {
  return new Set(['q.image', 'q.video.kling', 'q.video.runway', 'q.enhance', 'q.media']);
}

@Injectable()
export class VdCostService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projects: VdProjectRepository,
    private readonly costs: VdCostRepository,
  ) {}

  static shouldReserveQueue(queue: string): boolean {
    const q = queue.trim();
    return reserveQueues().has(q) || q.startsWith('q.video.');
  }

  estimateForEnqueue(queue: string, jobType: string, payload: Record<string, unknown>): number {
    const raw = payload.credit_estimate;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      return raw;
    }
    if (queue.startsWith('q.video.') || jobType.startsWith('cine_motion')) {
      const durationSec = Number(payload.durationSec);
      const sec = Number.isFinite(durationSec) && durationSec > 0 ? Math.floor(durationSec) : 5;
      const rate = jobType === 'cine_motion_final' ? FINAL_CREDIT_PER_SEC : DRAFT_CREDIT_PER_SEC;
      return sec * rate;
    }
    if (queue === 'q.enhance') return ENHANCE_CREDIT;
    if (queue === 'q.media') return 8;
    return IMAGE_CREDIT;
  }

  private warningsFor(actual: number, limit: number): VdCostWarnings {
    if (limit <= 0) return { warn70: false, warn90: false, warn100: false };
    const ratio = actual / limit;
    return {
      warn70: ratio >= 0.7,
      warn90: ratio >= 0.9,
      warn100: ratio >= 1,
    };
  }

  private async budgetView(projectId: number): Promise<VdBudgetView> {
    const budget = await this.costs.getBudget(projectId);
    const estimated_total = await this.costs.sumByKind(projectId, 'estimated');
    const actual_total = await this.costs.sumByKind(projectId, 'actual');
    return {
      ...budget,
      estimated_total,
      actual_total,
      warnings: this.warningsFor(actual_total, budget.limit_amount),
    };
  }

  async getBudget(projectId: number): Promise<VdBudgetView> {
    assertCinematicEnabled(this.config);
    const project = await this.projects.getById(projectId);
    if (!project) throw new Error('vd_project_not_found');
    return this.budgetView(projectId);
  }

  async setBudget(
    projectId: number,
    body: Record<string, unknown>,
  ): Promise<VdBudgetView> {
    assertCinematicEnabled(this.config);
    const project = await this.projects.getById(projectId);
    if (!project) throw new Error('vd_project_not_found');

    const patch: Partial<VdBudgetRow> = {};
    if (body.limit_amount != null) {
      const n = Number(body.limit_amount);
      if (!Number.isFinite(n) || n < 0) throw new Error('invalid_body');
      patch.limit_amount = n;
    }
    if (body.buffer_factor != null) {
      const n = Number(body.buffer_factor);
      if (!Number.isFinite(n) || n <= 0) throw new Error('invalid_body');
      patch.buffer_factor = n;
    }
    if (body.overshoot_factor != null) {
      const n = Number(body.overshoot_factor);
      if (!Number.isFinite(n) || n <= 0) throw new Error('invalid_body');
      patch.overshoot_factor = n;
    }
    if (body.alert_threshold != null) {
      const n = Number(body.alert_threshold);
      if (!Number.isFinite(n) || n < 0) throw new Error('invalid_body');
      patch.alert_threshold = n;
    }
    if (typeof body.currency === 'string' && body.currency.trim()) {
      patch.currency = body.currency.trim();
    }

    await this.costs.upsertBudget(projectId, patch);
    return this.budgetView(projectId);
  }

  async listCosts(projectId: number): Promise<VdCostsView> {
    assertCinematicEnabled(this.config);
    const project = await this.projects.getById(projectId);
    if (!project) throw new Error('vd_project_not_found');
    const items = await this.costs.listLedger(projectId);
    return {
      project_id: projectId,
      budget: await this.budgetView(projectId),
      items,
    };
  }

  async reserve(
    projectId: number,
    estimated: number,
    opts?: { job_id?: number | null; vendor?: string },
  ): Promise<VdCostLedgerRow> {
    assertCinematicEnabled(this.config);
    if (!Number.isFinite(estimated) || estimated <= 0) {
      throw new Error('invalid_body');
    }

    const budget = await this.costs.getBudget(projectId);
    const sumEstimated = await this.costs.sumByKind(projectId, 'estimated');
    const sumActual = await this.costs.sumByKind(projectId, 'actual');
    const cap = budget.limit_amount * budget.buffer_factor;
    if (sumEstimated + sumActual + estimated > cap) {
      throw new Error('budget_exceeded');
    }

    return this.costs.insertLedger({
      project_id: projectId,
      job_id: opts?.job_id ?? null,
      kind: 'estimated',
      amount: estimated,
      vendor: opts?.vendor ?? '',
    });
  }

  async exportXlsx(projectId: number, accountingClose: boolean): Promise<Buffer> {
    assertCinematicEnabled(this.config);
    const project = await this.projects.getById(projectId);
    if (!project) throw new Error('vd_project_not_found');

    if (accountingClose && !this.isProjectClosed(project.status, project.stage)) {
      throw new Error('project_not_closed');
    }

    const items = await this.costs.listLedger(projectId, 5000);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('vd_costs');
    ws.addRow(['kind', 'vendor', 'amount', 'created_at']);
    for (const row of items.slice().reverse()) {
      ws.addRow([row.kind, row.vendor, row.amount, row.created_at]);
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  actualFromJobState(state: ProviderJobState): number | null {
    return actualFromJobState(state);
  }

  reconcileProviderUsage(
    fixtures: Array<{ estimated: number; state: ProviderJobState }>,
  ): { ok: boolean; rows: Array<{ estimated: number; actual: number | null; within: boolean }> } {
    const rows = fixtures.map(({ estimated, state }) => {
      const actual = actualFromJobState(state);
      const within =
        actual == null ? false : reconcileWithinTolerance(estimated, actual);
      return { estimated, actual, within };
    });
    return { ok: rows.every((row) => row.within), rows };
  }

  private isProjectClosed(status: string, stage: string): boolean {
    return status === 'cancelled' || stage === 'archived';
  }
}
