import type { ReProjectRow } from './re-projects.types';

export interface CashFlowFilters {
  flow_type?: string;
  category?: string;
  status?: string;
}

export interface AccountingRepositoryPort {
  ensureAccountingSchema(): void | Promise<void>;
  queryCashFlowRows(
    projectId: number,
    filters?: CashFlowFilters,
  ): Array<Record<string, unknown>> | Promise<Array<Record<string, unknown>>>;
  getCashFlowRow(lineId: number): Record<string, unknown> | undefined | Promise<Record<string, unknown> | undefined>;
  insertCashFlowLine(projectId: number, fields: Array<string | number>, ts: string): number | Promise<number>;
  updateCashFlowLine(
    projectId: number,
    lineId: number,
    fields: Array<string | number>,
    ts: string,
  ): void | Promise<void>;
  deleteCashFlowLine(projectId: number, lineId: number): void | Promise<void>;
  findCashFlowBySourceRef(
    projectId: number,
    sourceRef: string,
  ): { id: number } | undefined | Promise<{ id: number } | undefined>;
  findBudgetBySourceRef(
    projectId: number,
    sourceRef: string,
  ): { id: number; planned_vnd: number } | undefined | Promise<{ id: number; planned_vnd: number } | undefined>;
  upsertBudgetByRef(
    projectId: number,
    data: {
      category: string;
      lineItem: string;
      plannedVnd: number;
      sourceRef: string;
      sourceType?: string;
      subCategory?: string;
    },
    ts: string,
  ): ['created' | 'updated' | 'skipped', number] | Promise<['created' | 'updated' | 'skipped', number]>;
  updateBudgetActual(
    projectId: number,
    budgetId: number,
    actualVnd: number,
    lineItem: string,
    ts: string,
  ): void | Promise<void>;
  insertInventoryBudgetLine(
    projectId: number,
    lineItem: string,
    period: string,
    actualVnd: number,
    ts: string,
  ): void | Promise<void>;
  nowTs(): string;
}

export interface AccountingProjectsPort {
  fetchProject(id: number): ReProjectRow | null | Promise<ReProjectRow | null>;
  listProducts(projectId: number): Array<Record<string, unknown>> | Promise<Array<Record<string, unknown>>>;
  listBudgetLines(projectId: number): Array<Record<string, unknown>> | Promise<Array<Record<string, unknown>>>;
  listRisks(projectId: number): Array<Record<string, unknown>> | Promise<Array<Record<string, unknown>>>;
  saveRisk(
    projectId: number,
    payload: Record<string, unknown>,
    riskId?: number,
    ts?: string,
  ): Record<string, unknown> | Promise<Record<string, unknown>>;
}

export interface AccountingDeps {
  accounting: AccountingRepositoryPort;
  projects: AccountingProjectsPort;
}
