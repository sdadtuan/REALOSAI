import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { REQUIRED_SALE_DOC_TYPES, type LegalGate } from './bds-legal-gate.util';

export type LegalDocUpsert = {
  id?: string;
  doc_type: string;
  status?: string;
  file_id?: string;
  issued_on?: string | null;
  expires_on?: string | null;
  required_for_sale?: boolean;
  tenant_id?: string | null;
};

export type LegalDocRow = {
  id: string;
  project_id: number;
  tenant_id: string | null;
  doc_type: string;
  status: string;
  file_id: string;
  issued_on: string | null;
  expires_on: string | null;
  required_for_sale: boolean;
};

export type ProjectGateRow = {
  legal_gate: LegalGate;
  legal_gate_override_until: Date | null;
  legal_gate_override_reason: string;
};

export type TowerInput = {
  code: string;
  name?: string;
  floor_min?: number;
  floor_max?: number;
  sort_order?: number;
  tenant_id?: string | null;
};

export type TowerRow = {
  id: string;
  project_id: number;
  tenant_id: string | null;
  code: string;
  name: string;
  floor_min: number;
  floor_max: number;
  sort_order: number;
};

export type ZoneInput = {
  code: string;
  name?: string;
  sort_order?: number;
  tenant_id?: string | null;
};

export type ZoneRow = {
  id: string;
  project_id: number;
  tenant_id: string | null;
  code: string;
  name: string;
  sort_order: number;
};

export type LayoutInput = {
  code: string;
  name?: string;
  area_m2?: number | null;
  list_price_vnd?: number;
  tenant_id?: string | null;
};

export type LayoutRow = {
  id: string;
  project_id: number;
  tenant_id: string | null;
  code: string;
  name: string;
  area_m2: number | null;
  list_price_vnd: number;
};

export type PhaseInput = {
  code: string;
  name?: string;
  open_to_channel?: boolean;
  tenant_id?: string | null;
};

export type PhaseStatus = 'planned' | 'active' | 'closed';

export type PhaseRow = {
  id: string;
  project_id: number;
  tenant_id: string | null;
  code: string;
  name: string;
  status: PhaseStatus;
  opens_at: Date | null;
  closes_at: Date | null;
  open_to_channel: boolean;
  price_list_id: number | null;
};

export type PlanKind = 'business' | 'marketing' | 'sales';

export type RevisionInput = {
  kind: string;
  body_json?: unknown;
  version: number;
  status?: string;
  tenant_id?: string | null;
};

export type RevisionRow = {
  id: string;
  project_id: number;
  tenant_id: string | null;
  kind: PlanKind;
  version: number;
  body_json: unknown;
  status: string;
  submitted_by: string;
  reviewed_by: string;
  reviewed_at: Date | null;
};

export type MilestoneInput = {
  code: string;
  name?: string;
  target_date?: string | null;
  actual_date?: string | null;
  unlocks_installment_index?: number | null;
  tenant_id?: string | null;
};

export type MilestoneRow = {
  id: string;
  project_id: number;
  tenant_id: string | null;
  code: string;
  name: string;
  target_date: string | null;
  actual_date: string | null;
  status: string;
  unlocks_installment_index: number | null;
};

function toDateStr(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

@Injectable()
export class BdsProjectOsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  private optStr(value: unknown): string | null {
    return value != null ? String(value) : null;
  }

  private optDate(value: unknown): Date | null {
    if (value == null || value === '') return null;
    return value instanceof Date ? value : new Date(String(value));
  }

  private mapTower(row: Record<string, unknown>): TowerRow {
    return {
      id: String(row.id),
      project_id: Number(row.project_id),
      tenant_id: this.optStr(row.tenant_id),
      code: String(row.code),
      name: String(row.name ?? ''),
      floor_min: Number(row.floor_min ?? 1),
      floor_max: Number(row.floor_max ?? 1),
      sort_order: Number(row.sort_order ?? 0),
    };
  }

  private mapZone(row: Record<string, unknown>): ZoneRow {
    return {
      id: String(row.id),
      project_id: Number(row.project_id),
      tenant_id: this.optStr(row.tenant_id),
      code: String(row.code),
      name: String(row.name ?? ''),
      sort_order: Number(row.sort_order ?? 0),
    };
  }

  private mapLayout(row: Record<string, unknown>): LayoutRow {
    return {
      id: String(row.id),
      project_id: Number(row.project_id),
      tenant_id: this.optStr(row.tenant_id),
      code: String(row.code),
      name: String(row.name ?? ''),
      area_m2: row.area_m2 == null ? null : Number(row.area_m2),
      list_price_vnd: Number(row.list_price_vnd ?? 0),
    };
  }

  private mapPhase(row: Record<string, unknown>): PhaseRow {
    return {
      id: String(row.id),
      project_id: Number(row.project_id),
      tenant_id: this.optStr(row.tenant_id),
      code: String(row.code),
      name: String(row.name ?? ''),
      status: String(row.status) as PhaseStatus,
      opens_at: this.optDate(row.opens_at),
      closes_at: this.optDate(row.closes_at),
      open_to_channel: Boolean(row.open_to_channel),
      price_list_id: row.price_list_id == null ? null : Number(row.price_list_id),
    };
  }

  private mapDoc(row: Record<string, unknown>): LegalDocRow {
    return {
      id: String(row.id),
      project_id: Number(row.project_id),
      tenant_id: row.tenant_id != null ? String(row.tenant_id) : null,
      doc_type: String(row.doc_type),
      status: String(row.status),
      file_id: String(row.file_id ?? ''),
      issued_on: toDateStr(row.issued_on),
      expires_on: toDateStr(row.expires_on),
      required_for_sale: Boolean(row.required_for_sale),
    };
  }

  async resolveProjectTenantId(projectId: number): Promise<string | null> {
    const res = await this.db.query(`SELECT tenant_id FROM crm_re_projects WHERE id = $1`, [
      projectId,
    ]);
    return res.rows[0]?.tenant_id != null ? String(res.rows[0].tenant_id) : null;
  }

  async listLegalDocs(projectId: number): Promise<LegalDocRow[]> {
    const res = await this.db.query(
      `SELECT id, project_id, tenant_id, doc_type, status, file_id, issued_on, expires_on, required_for_sale
       FROM bds_legal_documents
       WHERE project_id = $1
       ORDER BY doc_type, created_at`,
      [projectId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapDoc(row));
  }

  async upsertLegalDoc(projectId: number, doc: LegalDocUpsert): Promise<LegalDocRow> {
    const status = doc.status ?? 'missing';
    const fileId = doc.file_id ?? '';
    const issuedOn = doc.issued_on ?? null;
    const expiresOn = doc.expires_on ?? null;
    const required =
      doc.required_for_sale ??
      (REQUIRED_SALE_DOC_TYPES as readonly string[]).includes(doc.doc_type);
    const tenantId = doc.tenant_id ?? null;

    const res = await this.db.query(
      `INSERT INTO bds_legal_documents
         (project_id, doc_type, status, file_id, issued_on, expires_on, required_for_sale, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (project_id, doc_type) DO UPDATE SET
         status = EXCLUDED.status,
         file_id = EXCLUDED.file_id,
         issued_on = EXCLUDED.issued_on,
         expires_on = EXCLUDED.expires_on,
         required_for_sale = EXCLUDED.required_for_sale,
         tenant_id = COALESCE(EXCLUDED.tenant_id, bds_legal_documents.tenant_id),
         updated_at = NOW()
       RETURNING id, project_id, tenant_id, doc_type, status, file_id, issued_on, expires_on, required_for_sale`,
      [projectId, doc.doc_type, status, fileId, issuedOn, expiresOn, required, tenantId],
    );
    return this.mapDoc(res.rows[0] as Record<string, unknown>);
  }

  async getProjectGate(projectId: number): Promise<ProjectGateRow | null> {
    const res = await this.db.query(
      `SELECT legal_gate, legal_gate_override_until, legal_gate_override_reason
       FROM crm_re_projects
       WHERE id = $1
       LIMIT 1`,
      [projectId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const until = row.legal_gate_override_until;
    return {
      legal_gate: String(row.legal_gate) as LegalGate,
      legal_gate_override_until: until instanceof Date ? until : until ? new Date(String(until)) : null,
      legal_gate_override_reason: String(row.legal_gate_override_reason ?? ''),
    };
  }

  async setProjectGate(
    projectId: number,
    gate: LegalGate,
    overrideUntil?: Date | null,
    reason?: string,
  ): Promise<void> {
    if (arguments.length >= 3) {
      await this.db.query(
        `UPDATE crm_re_projects
         SET legal_gate = $2,
             legal_gate_override_until = $3,
             legal_gate_override_reason = $4
         WHERE id = $1`,
        [projectId, gate, overrideUntil ?? null, reason ?? ''],
      );
      return;
    }
    await this.db.query(`UPDATE crm_re_projects SET legal_gate = $2 WHERE id = $1`, [
      projectId,
      gate,
    ]);
  }

  async listTowers(projectId: number): Promise<TowerRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_towers WHERE project_id = $1 ORDER BY sort_order, code`,
      [projectId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapTower(row));
  }

  async createTower(projectId: number, input: TowerInput): Promise<TowerRow> {
    const res = await this.db.query(
      `INSERT INTO bds_towers (project_id, code, name, floor_min, floor_max, sort_order, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId,
        input.code,
        input.name ?? '',
        input.floor_min ?? 1,
        input.floor_max ?? 1,
        input.sort_order ?? 0,
        input.tenant_id ?? null,
      ],
    );
    return this.mapTower(res.rows[0] as Record<string, unknown>);
  }

  async listZones(projectId: number): Promise<ZoneRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_zones WHERE project_id = $1 ORDER BY sort_order, code`,
      [projectId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapZone(row));
  }

  async createZone(projectId: number, input: ZoneInput): Promise<ZoneRow> {
    const res = await this.db.query(
      `INSERT INTO bds_zones (project_id, code, name, sort_order, tenant_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, input.code, input.name ?? '', input.sort_order ?? 0, input.tenant_id ?? null],
    );
    return this.mapZone(res.rows[0] as Record<string, unknown>);
  }

  async listLayouts(projectId: number): Promise<LayoutRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_unit_layouts WHERE project_id = $1 ORDER BY code`,
      [projectId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapLayout(row));
  }

  async createLayout(projectId: number, input: LayoutInput): Promise<LayoutRow> {
    const res = await this.db.query(
      `INSERT INTO bds_unit_layouts (project_id, code, name, area_m2, list_price_vnd, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        projectId,
        input.code,
        input.name ?? '',
        input.area_m2 ?? null,
        input.list_price_vnd ?? 0,
        input.tenant_id ?? null,
      ],
    );
    return this.mapLayout(res.rows[0] as Record<string, unknown>);
  }

  async listPhases(projectId: number): Promise<PhaseRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_launch_phases WHERE project_id = $1 ORDER BY created_at, code`,
      [projectId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapPhase(row));
  }

  async createPhase(projectId: number, input: PhaseInput): Promise<PhaseRow> {
    const res = await this.db.query(
      `INSERT INTO bds_launch_phases (project_id, code, name, status, open_to_channel, tenant_id)
       VALUES ($1, $2, $3, 'planned', $4, $5)
       RETURNING *`,
      [
        projectId,
        input.code,
        input.name ?? '',
        input.open_to_channel ?? false,
        input.tenant_id ?? null,
      ],
    );
    return this.mapPhase(res.rows[0] as Record<string, unknown>);
  }

  async getPhase(phaseId: string): Promise<PhaseRow | null> {
    const res = await this.db.query(`SELECT * FROM bds_launch_phases WHERE id = $1 LIMIT 1`, [
      phaseId,
    ]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapPhase(row) : null;
  }

  async activatePhase(phaseId: string, projectId: number): Promise<PhaseRow> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE bds_launch_phases SET status='closed' WHERE project_id=$1 AND status='active' AND id<>$2`,
        [projectId, phaseId],
      );
      const res = await client.query(
        `UPDATE bds_launch_phases SET status='active', opens_at=COALESCE(opens_at, NOW()) WHERE id=$1 RETURNING *`,
        [phaseId],
      );
      await client.query(`UPDATE crm_re_projects SET current_phase_id=$2 WHERE id=$1`, [
        projectId,
        phaseId,
      ]);
      await client.query('COMMIT');
      return this.mapPhase(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* keep original err */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async closePhase(phaseId: string): Promise<PhaseRow | null> {
    const res = await this.db.query(
      `UPDATE bds_launch_phases SET status='closed' WHERE id=$1 RETURNING *`,
      [phaseId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapPhase(row) : null;
  }

  private mapRevision(row: Record<string, unknown>): RevisionRow {
    const body = row.body_json;
    return {
      id: String(row.id),
      project_id: Number(row.project_id),
      tenant_id: this.optStr(row.tenant_id),
      kind: String(row.kind) as PlanKind,
      version: Number(row.version),
      body_json: typeof body === 'string' ? JSON.parse(body) : (body ?? {}),
      status: String(row.status),
      submitted_by: String(row.submitted_by ?? ''),
      reviewed_by: String(row.reviewed_by ?? ''),
      reviewed_at: this.optDate(row.reviewed_at),
    };
  }

  private mapMilestone(row: Record<string, unknown>): MilestoneRow {
    return {
      id: String(row.id),
      project_id: Number(row.project_id),
      tenant_id: this.optStr(row.tenant_id),
      code: String(row.code),
      name: String(row.name ?? ''),
      target_date: toDateStr(row.target_date),
      actual_date: toDateStr(row.actual_date),
      status: String(row.status),
      unlocks_installment_index:
        row.unlocks_installment_index == null ? null : Number(row.unlocks_installment_index),
    };
  }

  async maxRevisionVersion(projectId: number, kind: string): Promise<number> {
    const res = await this.db.query(
      `SELECT COALESCE(MAX(version), 0) AS max FROM bds_plan_revisions
       WHERE project_id = $1 AND kind = $2`,
      [projectId, kind],
    );
    return Number((res.rows[0] as { max?: unknown } | undefined)?.max ?? 0);
  }

  async createRevision(projectId: number, input: RevisionInput): Promise<RevisionRow> {
    const res = await this.db.query(
      `INSERT INTO bds_plan_revisions (project_id, kind, version, body_json, status, tenant_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING *`,
      [
        projectId,
        input.kind,
        input.version,
        JSON.stringify(input.body_json ?? {}),
        input.status ?? 'draft',
        input.tenant_id ?? null,
      ],
    );
    return this.mapRevision(res.rows[0] as Record<string, unknown>);
  }

  async approveRevision(id: string, reviewedBy: string, reviewedAt: Date): Promise<RevisionRow | null> {
    const res = await this.db.query(
      `UPDATE bds_plan_revisions
       SET status = 'approved', reviewed_by = $2, reviewed_at = $3
       WHERE id = $1
       RETURNING *`,
      [id, reviewedBy, reviewedAt],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapRevision(row) : null;
  }

  async listRevisions(projectId: number): Promise<RevisionRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_plan_revisions WHERE project_id = $1 ORDER BY kind, version`,
      [projectId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapRevision(row));
  }

  async latestRevisionsByKind(projectId: number): Promise<RevisionRow[]> {
    const res = await this.db.query(
      `SELECT r.*
       FROM bds_plan_revisions r
       INNER JOIN (
         SELECT kind, MAX(version) AS version
         FROM bds_plan_revisions
         WHERE project_id = $1
         GROUP BY kind
       ) latest ON latest.kind = r.kind AND latest.version = r.version
       WHERE r.project_id = $1
       ORDER BY r.kind`,
      [projectId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapRevision(row));
  }

  async listMilestones(projectId: number): Promise<MilestoneRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_build_milestones WHERE project_id = $1 ORDER BY created_at, code`,
      [projectId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapMilestone(row));
  }

  async createMilestone(projectId: number, input: MilestoneInput): Promise<MilestoneRow> {
    const res = await this.db.query(
      `INSERT INTO bds_build_milestones
         (project_id, code, name, target_date, actual_date, unlocks_installment_index, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId,
        input.code,
        input.name ?? '',
        input.target_date ?? null,
        input.actual_date ?? null,
        input.unlocks_installment_index ?? null,
        input.tenant_id ?? null,
      ],
    );
    return this.mapMilestone(res.rows[0] as Record<string, unknown>);
  }

  async getMilestone(id: string): Promise<MilestoneRow | null> {
    const res = await this.db.query(`SELECT * FROM bds_build_milestones WHERE id = $1 LIMIT 1`, [
      id,
    ]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapMilestone(row) : null;
  }

  async getRevision(id: string): Promise<RevisionRow | null> {
    const res = await this.db.query(`SELECT * FROM bds_plan_revisions WHERE id = $1 LIMIT 1`, [id]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapRevision(row) : null;
  }

  async markMilestoneReached(id: string, actualDate: string): Promise<MilestoneRow | null> {
    const res = await this.db.query(
      `UPDATE bds_build_milestones
       SET status = 'reached', actual_date = $2
       WHERE id = $1
       RETURNING *`,
      [id, actualDate],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapMilestone(row) : null;
  }
}
