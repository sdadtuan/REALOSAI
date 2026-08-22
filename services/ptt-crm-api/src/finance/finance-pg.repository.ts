import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  buildFinanceKpiExportSheets,
  THRESHOLD_DEFAULTS,
  THRESHOLD_ENV_KEYS,
} from './finance-kpi.util';
import {
  collectFinanceKpiAlerts,
  getAlertThresholds,
  getArAging,
  getBusinessDashboardExecutive,
  getCacMetrics,
  getExecMetrics,
  getFinanceKpiInboxSummary,
  getFinanceKpiTrends,
  getFinancialIntelligence,
  getFinancialLifecycleRows,
  getLeadKpiSummary,
  getRecurringRevenueSummary,
  loadFinanceKpiBundle,
  setAlertThresholds,
  setMarketingSpendVnd,
  syncFinanceKpiInboxStub,
} from './finance-pg-metrics.util';

@Injectable()
export class FinancePgRepository implements OnModuleDestroy {
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

  async businessDashboard(
    year: number,
    month: number,
    trendMonths: number,
  ): Promise<Record<string, unknown>> {
    const bundle = await loadFinanceKpiBundle(this.db, year, month);
    return {
      year,
      month,
      trend_months: trendMonths,
      exec_metrics: bundle.exec_metrics,
      kpi_alerts: await collectFinanceKpiAlerts(this.db, year, month, bundle),
      trends: await getFinanceKpiTrends(this.db, year, month, trendMonths),
      executive: await getBusinessDashboardExecutive(this.db, year, month),
      thresholds: await getAlertThresholds(this.db),
      kpi_inbox: await getFinanceKpiInboxSummary(this.db),
      ...bundle,
    };
  }

  async financials(year: number, month: number): Promise<Record<string, unknown>> {
    const rows = await getFinancialLifecycleRows(this.db);
    const arAging = await getArAging(this.db);
    const recurringSummary = await getRecurringRevenueSummary(this.db, year, month);
    const bundle = await loadFinanceKpiBundle(this.db, year, month);
    const packageRollup = bundle.package_rollup;
    const kpiAlerts = await collectFinanceKpiAlerts(this.db, year, month, bundle);
    return {
      year,
      month,
      rows,
      ar_aging: arAging,
      recurring_summary: recurringSummary,
      package_rollup: packageRollup,
      retention_metrics: bundle.retention_metrics,
      lead_kpi: bundle.lead_kpi,
      portfolio_metrics: bundle.portfolio_metrics,
      exec_metrics: bundle.exec_metrics,
      kpi_alerts: kpiAlerts,
    };
  }

  async arAging(asOf?: string, amId?: number): Promise<Record<string, unknown>> {
    return getArAging(this.db, { asOf: asOf ?? null, amId: amId ?? null });
  }

  async recurringSummary(
    year: number,
    month: number,
    amId?: number,
  ): Promise<Record<string, unknown>> {
    return getRecurringRevenueSummary(this.db, year, month, amId ?? null);
  }

  async leadKpi(year: number, month: number, staffId?: number): Promise<Record<string, unknown>> {
    return getLeadKpiSummary(this.db, year, month, staffId ?? null);
  }

  async setPeriodInputs(
    year: number,
    month: number,
    marketingSpendVnd: number,
  ): Promise<Record<string, unknown>> {
    await setMarketingSpendVnd(this.db, year, month, marketingSpendVnd);
    return { ok: true, cac: await getCacMetrics(this.db, year, month) };
  }

  async kpiAlerts(year: number, month: number): Promise<Record<string, unknown>> {
    return collectFinanceKpiAlerts(this.db, year, month);
  }

  async kpiTrends(year: number, month: number, months: number): Promise<Record<string, unknown>> {
    return getFinanceKpiTrends(this.db, year, month, months);
  }

  async financialIntelligence(
    year: number,
    month: number,
    months: number,
  ): Promise<Record<string, unknown>> {
    return getFinancialIntelligence(this.db, year, month, months);
  }

  async kpiConfigGet(): Promise<Record<string, unknown>> {
    return {
      thresholds: await getAlertThresholds(this.db),
      defaults: THRESHOLD_DEFAULTS,
      env_keys: THRESHOLD_ENV_KEYS,
    };
  }

  async kpiConfigPatch(updates: Record<string, unknown>): Promise<Record<string, unknown>> {
    return { ok: true, thresholds: await setAlertThresholds(this.db, updates) };
  }

  async kpiExport(year: number, month: number): Promise<Record<string, unknown>> {
    const bundle = await loadFinanceKpiBundle(this.db, year, month);
    const sheets = buildFinanceKpiExportSheets(bundle);
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `crm-finance-kpi-${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${stamp}.json`,
      format: 'json',
      sheets,
    };
  }

  async kpiInboxSummary(): Promise<Record<string, unknown>> {
    return getFinanceKpiInboxSummary(this.db);
  }

  async kpiInboxSync(year: number, month: number): Promise<Record<string, unknown>> {
    return { ok: true, inbox: await syncFinanceKpiInboxStub(this.db, year, month) };
  }

  async kpiAlertCron(year: number, month: number): Promise<Record<string, unknown>> {
    const alerts = await collectFinanceKpiAlerts(this.db, year, month);
    return {
      ok: true,
      stub: true,
      year,
      month,
      alert_count: alerts.alert_count,
      critical_count: alerts.critical_count,
    };
  }

  async execMetrics(year: number, month: number): Promise<Record<string, unknown>> {
    return getExecMetrics(this.db, year, month);
  }
}
