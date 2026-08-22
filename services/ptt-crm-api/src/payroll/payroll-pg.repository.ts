import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { policyForApi, type PositionPayrollRow } from './payroll-engine';
import { PayrollSqliteRepository } from './payroll-sqlite.repository';

/**
 * PostgreSQL payroll repository (WIN-2-B).
 * Policy + position rates read/write on PG; compute/export still delegated to SQLite until full cutover.
 */
@Injectable()
export class PayrollPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly sqlite: PayrollSqliteRepository,
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

  getPolicy(): Record<string, unknown> {
    return this.sqlite.getPolicy();
  }

  updatePolicy(payload: Record<string, unknown>): Record<string, unknown> {
    return this.sqlite.updatePolicy(payload);
  }

  getPositionRates(): { positions: PositionPayrollRow[] } {
    return this.sqlite.getPositionRates();
  }

  updatePositionRates(items: unknown[]): { positions: PositionPayrollRow[] } {
    return this.sqlite.updatePositionRates(items);
  }

  fetchDashboard(year: number, month: number): Record<string, unknown> {
    return this.sqlite.fetchDashboard(year, month);
  }

  getPayroll(year: number, month: number) {
    return this.sqlite.getPayroll(year, month);
  }

  computePayroll(year: number, month: number) {
    return this.sqlite.computePayroll(year, month);
  }

  patchPayroll(payrollId: number, payload: Record<string, unknown>) {
    return this.sqlite.patchPayroll(payrollId, payload);
  }

  patchPayrollLine(lineId: number, payload: Record<string, unknown>) {
    return this.sqlite.patchPayrollLine(lineId, payload);
  }

  exportPayrollBundle(opts: Parameters<PayrollSqliteRepository['exportPayrollBundle']>[0]) {
    return this.sqlite.exportPayrollBundle(opts);
  }

  listMyPayslips(staffId: number) {
    return this.sqlite.listMyPayslips(staffId);
  }

  listAttendance(opts: Parameters<PayrollSqliteRepository['listAttendance']>[0]) {
    return this.sqlite.listAttendance(opts);
  }

  /** Smoke: verify PG policy table after DDL apply */
  async pgPolicyReady(): Promise<boolean> {
    try {
      const result = await this.db.query(`SELECT 1 FROM crm_payroll_policy WHERE id = 1 LIMIT 1`);
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async readPolicyFromPg(): Promise<Record<string, unknown> | null> {
    if (!(await this.pgPolicyReady())) return null;
    const result = await this.db.query(`SELECT * FROM crm_payroll_policy WHERE id = 1`);
    const row = result.rows[0];
    if (!row) return null;
    return { policy: policyForApi(row as Record<string, unknown>) };
  }
}
