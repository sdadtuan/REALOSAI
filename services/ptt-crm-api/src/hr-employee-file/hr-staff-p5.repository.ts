import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  CreateHrStaffDependentBody,
  HrHubExpirySample,
  HrHubExpirySummary,
  HrStaffDependentRow,
  HrStaffLifecycleRow,
  PatchHrStaffDependentBody,
  PatchHrStaffLifecycleBody,
} from './hr-staff-p5.types';
import { emptyLifecycleRow } from './hr-staff-p5.util';

const WALLET_LOW_PCT = 80;

@Injectable()
export class HrStaffP5Repository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private readyCache: boolean | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.readyCache = null;
  }

  async tablesReady(): Promise<boolean> {
    if (this.readyCache != null) return this.readyCache;
    try {
      await this.db.query(`SELECT 1 FROM hr_staff_dependents LIMIT 1`);
      this.readyCache = true;
    } catch {
      this.readyCache = false;
    }
    return this.readyCache;
  }

  private mapDependent(row: Record<string, unknown>): HrStaffDependentRow {
    return {
      id: Number(row.id),
      staff_id: Number(row.staff_id),
      name: String(row.name ?? ''),
      relation: String(row.relation ?? ''),
      dob: row.dob ? String(row.dob).slice(0, 10) : null,
      tax_dependent: Boolean(row.tax_dependent),
      cccd: String(row.cccd ?? ''),
      notes: String(row.notes ?? ''),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private mapLifecycle(row: Record<string, unknown>): HrStaffLifecycleRow {
    return {
      staff_id: Number(row.staff_id),
      stage: String(row.stage ?? 'offer') as HrStaffLifecycleRow['stage'],
      stage_changed_on: row.stage_changed_on ? String(row.stage_changed_on).slice(0, 10) : null,
      notes: String(row.notes ?? ''),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  async listDependents(staffId: number): Promise<HrStaffDependentRow[]> {
    const result = await this.db.query(
      `SELECT id::int, staff_id::int, name, relation, dob::text, tax_dependent,
              cccd, notes, created_at::text, updated_at::text
       FROM hr_staff_dependents
       WHERE staff_id = $1
       ORDER BY tax_dependent DESC, name ASC, id ASC`,
      [staffId],
    );
    return result.rows.map((r) => this.mapDependent(r as Record<string, unknown>));
  }

  async createDependent(staffId: number, body: CreateHrStaffDependentBody): Promise<HrStaffDependentRow> {
    const result = await this.db.query(
      `INSERT INTO hr_staff_dependents (staff_id, name, relation, dob, tax_dependent, cccd, notes)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7)
       RETURNING id::int, staff_id::int, name, relation, dob::text, tax_dependent,
                 cccd, notes, created_at::text, updated_at::text`,
      [
        staffId,
        String(body.name ?? ''),
        String(body.relation ?? ''),
        body.dob ?? null,
        Boolean(body.tax_dependent),
        String(body.cccd ?? ''),
        String(body.notes ?? ''),
      ],
    );
    return this.mapDependent(result.rows[0] as Record<string, unknown>);
  }

  async patchDependent(
    staffId: number,
    dependentId: number,
    body: PatchHrStaffDependentBody,
  ): Promise<HrStaffDependentRow> {
    const result = await this.db.query(
      `UPDATE hr_staff_dependents SET
         name = COALESCE($3, name),
         relation = COALESCE($4, relation),
         dob = COALESCE($5::date, dob),
         tax_dependent = COALESCE($6, tax_dependent),
         cccd = COALESCE($7, cccd),
         notes = COALESCE($8, notes),
         updated_at = NOW()
       WHERE id = $1 AND staff_id = $2
       RETURNING id::int, staff_id::int, name, relation, dob::text, tax_dependent,
                 cccd, notes, created_at::text, updated_at::text`,
      [
        dependentId,
        staffId,
        body.name ?? null,
        body.relation ?? null,
        body.dob ?? null,
        body.tax_dependent ?? null,
        body.cccd ?? null,
        body.notes ?? null,
      ],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'dependent_not_found', id: dependentId });
    return this.mapDependent(result.rows[0] as Record<string, unknown>);
  }

  async deleteDependent(staffId: number, dependentId: number): Promise<void> {
    const result = await this.db.query(
      `DELETE FROM hr_staff_dependents WHERE id = $1 AND staff_id = $2 RETURNING id::int`,
      [dependentId, staffId],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'dependent_not_found', id: dependentId });
  }

  async getLifecycle(staffId: number): Promise<HrStaffLifecycleRow> {
    const result = await this.db.query(
      `SELECT staff_id::int, stage, stage_changed_on::text, notes, created_at::text, updated_at::text
       FROM hr_staff_lifecycle WHERE staff_id = $1 LIMIT 1`,
      [staffId],
    );
    const row = result.rows[0];
    if (!row) return emptyLifecycleRow(staffId);
    return this.mapLifecycle(row as Record<string, unknown>);
  }

  async patchLifecycle(staffId: number, body: PatchHrStaffLifecycleBody): Promise<HrStaffLifecycleRow> {
    const current = await this.getLifecycle(staffId);
    const nextStage = body.stage ?? current.stage;
    const stageChanged =
      body.stage_changed_on !== undefined
        ? body.stage_changed_on
        : body.stage && body.stage !== current.stage
          ? new Date().toISOString().slice(0, 10)
          : current.stage_changed_on;
    const notes = body.notes !== undefined ? body.notes : current.notes;

    if (!current.created_at) {
      await this.db.query(
        `INSERT INTO hr_staff_lifecycle (staff_id, stage, stage_changed_on, notes)
         VALUES ($1, $2, $3::date, $4)`,
        [staffId, nextStage, stageChanged, notes],
      );
    } else {
      await this.db.query(
        `UPDATE hr_staff_lifecycle SET
           stage = $2,
           stage_changed_on = $3::date,
           notes = $4,
           updated_at = NOW()
         WHERE staff_id = $1`,
        [staffId, nextStage, stageChanged, notes],
      );
    }
    return this.getLifecycle(staffId);
  }

  async checkOfficialGate(staffId: number): Promise<string[]> {
    const missing: string[] = [];
    const contract = await this.db.query(
      `SELECT 1 FROM hr_labor_contracts WHERE staff_id = $1 AND status = 'active' LIMIT 1`,
      [staffId],
    );
    if (!contract.rows[0]) missing.push('active_contract');

    const identity = await this.db.query(
      `SELECT cccd, legal_name FROM hr_staff_identity WHERE staff_id = $1 LIMIT 1`,
      [staffId],
    );
    const idRow = identity.rows[0] as Record<string, unknown> | undefined;
    if (!idRow?.cccd || !String(idRow.cccd).trim()) missing.push('cccd');
    if (!idRow?.legal_name || !String(idRow.legal_name).trim()) missing.push('legal_name');

    const addr = await this.db.query(
      `SELECT line1 FROM hr_staff_addresses WHERE staff_id = $1 AND kind = 'permanent' LIMIT 1`,
      [staffId],
    );
    const addrRow = addr.rows[0] as Record<string, unknown> | undefined;
    if (!addrRow?.line1 || !String(addrRow.line1).trim()) missing.push('permanent_address');

    return missing;
  }

  async hubExpirySummary(limit = 8): Promise<HrHubExpirySummary> {
    const walletExp = await this.db.query(
      `SELECT COUNT(DISTINCT w.staff_id)::int AS cnt
       FROM hr_doc_wallet w
       JOIN crm_staff s ON s.id = w.staff_id AND s.active = 1
       WHERE w.deleted_at IS NULL
         AND w.expires_on IS NOT NULL
         AND w.expires_on <= (CURRENT_DATE + INTERVAL '30 days')
         AND w.expires_on >= CURRENT_DATE`,
    );
    const contractExp = await this.db.query(
      `SELECT COUNT(DISTINCT c.staff_id)::int AS cnt
       FROM hr_labor_contracts c
       JOIN crm_staff s ON s.id = c.staff_id AND s.active = 1
       WHERE c.status = 'active'
         AND c.expires_on IS NOT NULL
         AND c.expires_on <= (CURRENT_DATE + INTERVAL '30 days')
         AND c.expires_on >= CURRENT_DATE`,
    );
    const bhytExp = await this.db.query(
      `SELECT COUNT(DISTINCT i.staff_id)::int AS cnt
       FROM hr_staff_insurance i
       JOIN crm_staff s ON s.id = i.staff_id AND s.active = 1
       WHERE i.bhyt_valid_to IS NOT NULL
         AND i.bhyt_valid_to <= (CURRENT_DATE + INTERVAL '30 days')
         AND i.bhyt_valid_to >= CURRENT_DATE`,
    );

    const samples: HrHubExpirySample[] = [];

    const walletSamples = await this.db.query(
      `SELECT DISTINCT ON (w.staff_id) w.staff_id::int, s.name, s.internal_code,
              w.title, w.expires_on::text
       FROM hr_doc_wallet w
       JOIN crm_staff s ON s.id = w.staff_id AND s.active = 1
       WHERE w.deleted_at IS NULL
         AND w.expires_on IS NOT NULL
         AND w.expires_on <= (CURRENT_DATE + INTERVAL '30 days')
         AND w.expires_on >= CURRENT_DATE
       ORDER BY w.staff_id, w.expires_on ASC
       LIMIT $1`,
      [limit],
    );
    for (const row of walletSamples.rows) {
      const r = row as Record<string, unknown>;
      samples.push({
        staff_id: Number(r.staff_id),
        name: String(r.name ?? ''),
        internal_code: String(r.internal_code ?? ''),
        kind: 'wallet',
        detail: `${String(r.title ?? 'Giấy tờ')} · ${String(r.expires_on ?? '').slice(0, 10)}`,
      });
    }

    const contractSamples = await this.db.query(
      `SELECT c.staff_id::int, s.name, s.internal_code, c.contract_no, c.expires_on::text
       FROM hr_labor_contracts c
       JOIN crm_staff s ON s.id = c.staff_id AND s.active = 1
       WHERE c.status = 'active'
         AND c.expires_on IS NOT NULL
         AND c.expires_on <= (CURRENT_DATE + INTERVAL '30 days')
         AND c.expires_on >= CURRENT_DATE
       ORDER BY c.expires_on ASC
       LIMIT $1`,
      [Math.max(0, limit - samples.length)],
    );
    for (const row of contractSamples.rows) {
      const r = row as Record<string, unknown>;
      samples.push({
        staff_id: Number(r.staff_id),
        name: String(r.name ?? ''),
        internal_code: String(r.internal_code ?? ''),
        kind: 'contract',
        detail: `HĐ ${String(r.contract_no ?? '')} · ${String(r.expires_on ?? '').slice(0, 10)}`,
      });
    }

    const walletLow = (await this.walletTablesExist()) ? await this.countLowWalletStaff() : 0;

    return {
      wallet_expiring_staff: Number((walletExp.rows[0] as Record<string, unknown>)?.cnt ?? 0),
      wallet_low_pct_staff: walletLow,
      contract_expiring_staff: Number((contractExp.rows[0] as Record<string, unknown>)?.cnt ?? 0),
      bhyt_expiring_staff: Number((bhytExp.rows[0] as Record<string, unknown>)?.cnt ?? 0),
      samples: samples.slice(0, limit),
    };
  }

  private async walletTablesExist(): Promise<boolean> {
    try {
      await this.db.query(`SELECT 1 FROM hr_doc_wallet LIMIT 1`);
      return true;
    } catch {
      return false;
    }
  }

  private async countLowWalletStaff(): Promise<number> {
    const staffResult = await this.db.query(
      `SELECT id::int FROM crm_staff WHERE active = 1 ORDER BY id ASC LIMIT 500`,
    );
    const requiredResult = await this.db.query(
      `SELECT type_code FROM hr_doc_types WHERE is_required_onboard = TRUE`,
    );
    const required = requiredResult.rows.map((r) => String((r as Record<string, unknown>).type_code));
    if (!required.length) return 0;

    let low = 0;
    for (const row of staffResult.rows) {
      const staffId = Number((row as Record<string, unknown>).id);
      const cards = await this.db.query(
        `SELECT type_code, status, (
           SELECT COUNT(*)::int FROM hr_doc_wallet_files f WHERE f.card_id = w.id
         ) AS file_count
         FROM hr_doc_wallet w
         WHERE w.staff_id = $1 AND w.deleted_at IS NULL`,
        [staffId],
      );
      const validTypes = new Set<string>();
      for (const c of cards.rows) {
        const cr = c as Record<string, unknown>;
        if (String(cr.status) === 'valid' && Number(cr.file_count) > 0) {
          validTypes.add(String(cr.type_code));
        }
      }
      const pct = Math.round((required.filter((t) => validTypes.has(t)).length / required.length) * 100);
      if (pct < WALLET_LOW_PCT) low += 1;
    }
    return low;
  }
}
