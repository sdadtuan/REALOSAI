import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type {
  FeeUnit,
  PolicyAudience,
  PolicyStatus,
  VatMode,
} from './bds-policy.types';

export type PolicyRow = {
  id: string;
  tenant_id: string | null;
  project_id: number;
  code: string;
  name: string;
  status: PolicyStatus;
  audience: PolicyAudience;
  effective_from: Date | null;
  effective_to: Date | null;
  discount_cap_pct: number;
  hold_ttl_minutes: number | null;
  deposit_min_vnd: number;
  vbtt_min_paid_pct: number;
  hdmb_min_paid_pct: number;
  payment_template_json: unknown;
  vat_mode: VatMode;
  maintenance_fee_vnd: number;
  fee_unit: FeeUnit;
  rules_json: unknown;
  activated_by: string;
  activated_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type InsertPolicyInput = {
  tenant_id?: string | null;
  project_id: number;
  code: string;
  name?: string;
  audience?: PolicyAudience;
  effective_from?: Date | null;
  effective_to?: Date | null;
  discount_cap_pct?: number;
  hold_ttl_minutes?: number | null;
  deposit_min_vnd?: number;
  vbtt_min_paid_pct?: number;
  hdmb_min_paid_pct?: number;
  payment_template_json?: unknown;
  vat_mode?: VatMode;
  maintenance_fee_vnd?: number;
  fee_unit?: FeeUnit;
  rules_json?: unknown;
};

export type UpdatePolicyDraftInput = Partial<
  Omit<InsertPolicyInput, 'tenant_id' | 'project_id' | 'code'>
> & { code?: string; name?: string };

export type PriceListRow = {
  id: number;
  project_id: number;
  tenant_id: string | null;
  policy_id: string | null;
  version_code: string;
  name: string;
  effective_date: string;
  status: PolicyStatus;
  notes: string;
  applied_at: string;
  applied_by: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

export type InsertPriceListInput = {
  project_id: number;
  tenant_id?: string | null;
  version_code: string;
  name?: string;
  effective_date?: string;
  notes?: string;
  created_by?: string;
};

export type PriceListItemRow = {
  id: number;
  price_list_id: number;
  unit_code: string;
  zone: string;
  list_price_vnd: number;
  net_price_vnd: number;
  notes: string;
  created_at: Date;
  updated_at: Date;
};

export type UpsertPriceListItemInput = {
  unit_code: string;
  zone?: string;
  list_price_vnd?: number;
  net_price_vnd?: number;
  notes?: string;
};

@Injectable()
export class BdsPolicyRepository implements OnModuleDestroy {
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

  private asDate(value: unknown): Date {
    if (value instanceof Date) return value;
    return new Date(String(value));
  }

  private mapPolicy(row: Record<string, unknown>): PolicyRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      project_id: Number(row.project_id),
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      status: String(row.status) as PolicyStatus,
      audience: String(row.audience) as PolicyAudience,
      effective_from: this.optDate(row.effective_from),
      effective_to: this.optDate(row.effective_to),
      discount_cap_pct: Number(row.discount_cap_pct ?? 0),
      hold_ttl_minutes:
        row.hold_ttl_minutes == null ? null : Number(row.hold_ttl_minutes),
      deposit_min_vnd: Number(row.deposit_min_vnd ?? 0),
      vbtt_min_paid_pct: Number(row.vbtt_min_paid_pct ?? 0),
      hdmb_min_paid_pct: Number(row.hdmb_min_paid_pct ?? 30),
      payment_template_json: row.payment_template_json ?? [],
      vat_mode: String(row.vat_mode ?? 'included') as VatMode,
      maintenance_fee_vnd: Number(row.maintenance_fee_vnd ?? 0),
      fee_unit: String(row.fee_unit ?? 'per_unit') as FeeUnit,
      rules_json: row.rules_json ?? {},
      activated_by: String(row.activated_by ?? ''),
      activated_at: this.optDate(row.activated_at),
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  private mapPriceList(row: Record<string, unknown>): PriceListRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      tenant_id: this.optStr(row.tenant_id),
      policy_id: this.optStr(row.policy_id),
      version_code: String(row.version_code ?? ''),
      name: String(row.name ?? ''),
      effective_date: String(row.effective_date ?? ''),
      status: String(row.status) as PolicyStatus,
      notes: String(row.notes ?? ''),
      applied_at: String(row.applied_at ?? ''),
      applied_by: String(row.applied_by ?? ''),
      created_by: String(row.created_by ?? ''),
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  private mapPriceListItem(row: Record<string, unknown>): PriceListItemRow {
    return {
      id: Number(row.id),
      price_list_id: Number(row.price_list_id),
      unit_code: String(row.unit_code ?? ''),
      zone: String(row.zone ?? ''),
      list_price_vnd: Number(row.list_price_vnd ?? 0),
      net_price_vnd: Number(row.net_price_vnd ?? 0),
      notes: String(row.notes ?? ''),
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  async resolveProjectTenantId(projectId: number): Promise<string | null> {
    const res = await this.db.query(
      `SELECT tenant_id FROM crm_re_projects WHERE id = $1 LIMIT 1`,
      [projectId],
    );
    if (!res.rows[0]) return null;
    return this.optStr(res.rows[0].tenant_id);
  }

  async getProjectOnePrice(projectId: number): Promise<boolean | null> {
    const res = await this.db.query(
      `SELECT one_price FROM crm_re_projects WHERE id = $1`,
      [projectId],
    );
    if (!res.rows[0]) return null;
    return Boolean(res.rows[0].one_price);
  }

  async insertPolicy(row: InsertPolicyInput): Promise<PolicyRow> {
    try {
      const res = await this.db.query(
        `INSERT INTO bds_sales_policies (
           tenant_id, project_id, code, name, audience,
           effective_from, effective_to, discount_cap_pct, hold_ttl_minutes,
           deposit_min_vnd, vbtt_min_paid_pct, hdmb_min_paid_pct,
           payment_template_json, vat_mode, maintenance_fee_vnd, fee_unit, rules_json
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12,
           $13::jsonb, $14, $15, $16, $17::jsonb
         )
         RETURNING *`,
        [
          row.tenant_id ?? null,
          row.project_id,
          row.code,
          row.name ?? '',
          row.audience ?? 'all',
          row.effective_from ?? null,
          row.effective_to ?? null,
          row.discount_cap_pct ?? 0,
          row.hold_ttl_minutes ?? null,
          row.deposit_min_vnd ?? 0,
          row.vbtt_min_paid_pct ?? 0,
          row.hdmb_min_paid_pct ?? 30,
          JSON.stringify(row.payment_template_json ?? []),
          row.vat_mode ?? 'included',
          row.maintenance_fee_vnd ?? 0,
          row.fee_unit ?? 'per_unit',
          JSON.stringify(row.rules_json ?? {}),
        ],
      );
      return this.mapPolicy(res.rows[0]);
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw { code: '23505' };
      }
      throw err;
    }
  }

  async updateDraft(id: string, patch: UpdatePolicyDraftInput): Promise<PolicyRow | null> {
    const sets: string[] = [];
    const vals: unknown[] = [id];
    let idx = 2;

    const add = (col: string, val: unknown) => {
      sets.push(`${col} = $${idx}`);
      vals.push(val);
      idx += 1;
    };

    if (patch.code !== undefined) add('code', patch.code);
    if (patch.name !== undefined) add('name', patch.name);
    if (patch.audience !== undefined) add('audience', patch.audience);
    if (patch.effective_from !== undefined) add('effective_from', patch.effective_from);
    if (patch.effective_to !== undefined) add('effective_to', patch.effective_to);
    if (patch.discount_cap_pct !== undefined) add('discount_cap_pct', patch.discount_cap_pct);
    if (patch.hold_ttl_minutes !== undefined) add('hold_ttl_minutes', patch.hold_ttl_minutes);
    if (patch.deposit_min_vnd !== undefined) add('deposit_min_vnd', patch.deposit_min_vnd);
    if (patch.vbtt_min_paid_pct !== undefined) add('vbtt_min_paid_pct', patch.vbtt_min_paid_pct);
    if (patch.hdmb_min_paid_pct !== undefined) add('hdmb_min_paid_pct', patch.hdmb_min_paid_pct);
    if (patch.payment_template_json !== undefined) {
      sets.push(`payment_template_json = $${idx}::jsonb`);
      vals.push(JSON.stringify(patch.payment_template_json));
      idx += 1;
    }
    if (patch.vat_mode !== undefined) add('vat_mode', patch.vat_mode);
    if (patch.maintenance_fee_vnd !== undefined) add('maintenance_fee_vnd', patch.maintenance_fee_vnd);
    if (patch.fee_unit !== undefined) add('fee_unit', patch.fee_unit);
    if (patch.rules_json !== undefined) {
      sets.push(`rules_json = $${idx}::jsonb`);
      vals.push(JSON.stringify(patch.rules_json));
      idx += 1;
    }

    if (sets.length === 0) {
      const cur = await this.getPolicy(id);
      return cur?.status === 'draft' ? cur : null;
    }

    sets.push('updated_at = NOW()');
    const res = await this.db.query(
      `UPDATE bds_sales_policies SET ${sets.join(', ')}
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      vals,
    );
    return res.rows[0] ? this.mapPolicy(res.rows[0]) : null;
  }

  async getPolicy(id: string): Promise<PolicyRow | null> {
    const res = await this.db.query(`SELECT * FROM bds_sales_policies WHERE id = $1`, [id]);
    return res.rows[0] ? this.mapPolicy(res.rows[0]) : null;
  }

  async listByProject(projectId: number): Promise<PolicyRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_sales_policies WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    return res.rows.map((row) => this.mapPolicy(row));
  }

  async setPolicyStatusIf(
    id: string,
    status: PolicyStatus,
    extra: { activated_by?: string },
    expected: PolicyStatus,
  ): Promise<PolicyRow | null> {
    const res = await this.db.query(
      `UPDATE bds_sales_policies
       SET status = $2,
           activated_by = COALESCE($3, activated_by),
           activated_at = CASE WHEN $2 = 'active' THEN NOW() ELSE activated_at END,
           updated_at = NOW()
       WHERE id = $1 AND status = $4
       RETURNING *`,
      [id, status, extra.activated_by ?? null, expected],
    );
    return res.rows[0] ? this.mapPolicy(res.rows[0]) : null;
  }

  async archiveActiveAudience(
    projectId: number,
    audience: PolicyAudience,
    exceptId: string,
  ): Promise<number> {
    const res = await this.db.query(
      `UPDATE bds_sales_policies
       SET status = 'archived', updated_at = NOW()
       WHERE project_id = $1 AND audience = $2 AND status = 'active' AND id <> $3`,
      [projectId, audience, exceptId],
    );
    return res.rowCount ?? 0;
  }

  async insertPriceList(row: InsertPriceListInput): Promise<PriceListRow> {
    try {
      const res = await this.db.query(
        `INSERT INTO crm_re_price_lists (
           project_id, tenant_id, version_code, name, effective_date, notes, created_by, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
         RETURNING *`,
        [
          row.project_id,
          row.tenant_id ?? null,
          row.version_code,
          row.name ?? row.version_code,
          row.effective_date ?? '',
          row.notes ?? '',
          row.created_by ?? '',
        ],
      );
      return this.mapPriceList(res.rows[0]);
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw { code: '23505' };
      }
      throw err;
    }
  }

  async getPriceList(id: number): Promise<PriceListRow | null> {
    const res = await this.db.query(`SELECT * FROM crm_re_price_lists WHERE id = $1`, [id]);
    return res.rows[0] ? this.mapPriceList(res.rows[0]) : null;
  }

  async listPriceLists(projectId: number): Promise<PriceListRow[]> {
    const res = await this.db.query(
      `SELECT * FROM crm_re_price_lists WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    return res.rows.map((row) => this.mapPriceList(row));
  }

  async upsertPriceListItem(
    priceListId: number,
    item: UpsertPriceListItemInput,
  ): Promise<PriceListItemRow> {
    const upd = await this.db.query(
      `UPDATE crm_re_price_list_items
       SET zone = $3, list_price_vnd = $4, net_price_vnd = $5, notes = $6, updated_at = NOW()
       WHERE price_list_id = $1 AND lower(trim(unit_code)) = lower(trim($2))
       RETURNING *`,
      [
        priceListId,
        item.unit_code,
        item.zone ?? '',
        item.list_price_vnd ?? 0,
        item.net_price_vnd ?? 0,
        item.notes ?? '',
      ],
    );
    if (upd.rows[0]) return this.mapPriceListItem(upd.rows[0]);

    const ins = await this.db.query(
      `INSERT INTO crm_re_price_list_items (
         price_list_id, unit_code, zone, list_price_vnd, net_price_vnd, notes
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        priceListId,
        item.unit_code,
        item.zone ?? '',
        item.list_price_vnd ?? 0,
        item.net_price_vnd ?? 0,
        item.notes ?? '',
      ],
    );
    return this.mapPriceListItem(ins.rows[0]);
  }

  async listPriceListItems(priceListId: number): Promise<PriceListItemRow[]> {
    const res = await this.db.query(
      `SELECT * FROM crm_re_price_list_items WHERE price_list_id = $1 ORDER BY unit_code`,
      [priceListId],
    );
    return res.rows.map((row) => this.mapPriceListItem(row));
  }

  async setPriceListPolicy(priceListId: number, policyId: string): Promise<void> {
    await this.db.query(
      `UPDATE crm_re_price_lists SET policy_id = $2, updated_at = NOW() WHERE id = $1`,
      [priceListId, policyId],
    );
  }

  async getPhase(phaseId: string): Promise<{ id: string; project_id: number } | null> {
    const res = await this.db.query(
      `SELECT id, project_id FROM bds_launch_phases WHERE id = $1`,
      [phaseId],
    );
    if (!res.rows[0]) return null;
    return { id: String(res.rows[0].id), project_id: Number(res.rows[0].project_id) };
  }

  async setPhaseSnapshot(phaseId: string, policyId: string, priceListId: number): Promise<void> {
    await this.db.query(
      `UPDATE bds_launch_phases SET policy_id = $2, price_list_id = $3 WHERE id = $1`,
      [phaseId, policyId, priceListId],
    );
  }
}
