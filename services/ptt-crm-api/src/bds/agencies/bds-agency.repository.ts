import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { TIER_SEED, type AgencyRow, type BasketRuleRow, type BasketUnitRow, type ContractRow, type TierRow } from './bds-agency.types';

@Injectable()
export class BdsAgencyRepository implements OnModuleDestroy {
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

  private mapTier(row: Record<string, unknown>): TierRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      code: String(row.code),
      name: String(row.name ?? ''),
      min_score: Number(row.min_score ?? 0),
      max_concurrent_holds: Number(row.max_concurrent_holds ?? 0),
      exclusive_allowed: Boolean(row.exclusive_allowed),
      ttl_multiplier: Number(row.ttl_multiplier ?? 1),
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  private mapAgency(row: Record<string, unknown>): AgencyRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      code: String(row.code),
      name: String(row.name ?? ''),
      legal_name: String(row.legal_name ?? ''),
      tax_id: String(row.tax_id ?? ''),
      kind: String(row.kind) as AgencyRow['kind'],
      parent_agency_id: this.optStr(row.parent_agency_id),
      status: String(row.status) as AgencyRow['status'],
      tier_id: this.optStr(row.tier_id),
      tier_override: Boolean(row.tier_override),
      tier_override_reason: String(row.tier_override_reason ?? ''),
      tier_override_until: this.optDate(row.tier_override_until),
      owner_staff_id: row.owner_staff_id == null ? null : Number(row.owner_staff_id),
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  private mapContract(row: Record<string, unknown>): ContractRow {
    return {
      id: String(row.id),
      agency_id: String(row.agency_id),
      project_id: Number(row.project_id),
      status: String(row.status) as ContractRow['status'],
      signed_on: this.optDate(row.signed_on),
      expires_on: this.optDate(row.expires_on),
      exclusive_project: Boolean(row.exclusive_project),
      max_concurrent_holds:
        row.max_concurrent_holds == null ? null : Number(row.max_concurrent_holds),
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  private mapRule(row: Record<string, unknown>): BasketRuleRow {
    return {
      id: String(row.id),
      agency_id: String(row.agency_id),
      project_id: Number(row.project_id),
      scope_type: String(row.scope_type),
      exclusivity: String(row.exclusivity) as BasketRuleRow['exclusivity'],
      status: String(row.status),
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  private mapBasketUnit(row: Record<string, unknown>): BasketUnitRow {
    return {
      id: String(row.id),
      rule_id: String(row.rule_id),
      agency_id: String(row.agency_id),
      project_id: Number(row.project_id),
      product_id: Number(row.product_id),
      exclusivity: String(row.exclusivity) as BasketUnitRow['exclusivity'],
      granted_at: this.asDate(row.granted_at),
      granted_by: String(row.granted_by ?? ''),
      revoked_at: this.optDate(row.revoked_at),
      revoke_reason: String(row.revoke_reason ?? ''),
      created_at: this.asDate(row.created_at),
    };
  }

  async ensureTiers(tenantId?: string | null): Promise<TierRow[]> {
    const tid = String(tenantId ?? '').trim() || null;
    for (const tier of TIER_SEED) {
      await this.db.query(
        `INSERT INTO bds_tier_defs (
           tenant_id, code, name, min_score, max_concurrent_holds, exclusive_allowed, ttl_multiplier
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (tenant_id, code) DO NOTHING`,
        [
          tid,
          tier.code,
          tier.name,
          tier.min_score,
          tier.max_concurrent_holds,
          tier.exclusive_allowed,
          tier.ttl_multiplier,
        ],
      );
    }
    return this.listTiers(tid);
  }

  async listTiers(tenantId?: string | null): Promise<TierRow[]> {
    const tid = String(tenantId ?? '').trim() || null;
    const res = await this.db.query(
      `SELECT * FROM bds_tier_defs WHERE tenant_id IS NOT DISTINCT FROM $1 ORDER BY min_score ASC`,
      [tid],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapTier(row));
  }

  async getTierByCode(tenantId: string | null | undefined, code: string): Promise<TierRow | null> {
    const tid = String(tenantId ?? '').trim() || null;
    const res = await this.db.query(
      `SELECT * FROM bds_tier_defs WHERE tenant_id IS NOT DISTINCT FROM $1 AND code = $2 LIMIT 1`,
      [tid, code],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapTier(row) : null;
  }

  async getTier(id: string): Promise<TierRow | null> {
    const res = await this.db.query(`SELECT * FROM bds_tier_defs WHERE id = $1 LIMIT 1`, [id]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapTier(row) : null;
  }

  async insertAgency(row: {
    tenant_id?: string | null;
    code: string;
    name?: string;
    legal_name?: string;
    tax_id?: string;
    kind?: string;
    parent_agency_id?: string | null;
    status?: string;
  }): Promise<AgencyRow> {
    const tenantId = String(row.tenant_id ?? '').trim() || null;
    try {
      const res = await this.db.query(
        `INSERT INTO bds_agencies (
           tenant_id, code, name, legal_name, tax_id, kind, parent_agency_id, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          tenantId,
          row.code,
          String(row.name ?? ''),
          String(row.legal_name ?? ''),
          String(row.tax_id ?? ''),
          row.kind ?? 'f1',
          row.parent_agency_id ?? null,
          row.status ?? 'prospect',
        ],
      );
      return this.mapAgency(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw { code: '23505' };
      }
      throw err;
    }
  }

  async getAgency(id: string): Promise<AgencyRow | null> {
    const res = await this.db.query(`SELECT * FROM bds_agencies WHERE id = $1 LIMIT 1`, [id]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapAgency(row) : null;
  }

  async listAgencies(tenantId?: string | null): Promise<AgencyRow[]> {
    const tid = String(tenantId ?? '').trim() || null;
    const res = await this.db.query(
      `SELECT * FROM bds_agencies WHERE tenant_id IS NOT DISTINCT FROM $1 ORDER BY created_at DESC`,
      [tid],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapAgency(row));
  }

  async setAgencyStatusIf(
    id: string,
    status: string,
    extra: { tier_id?: string | null } | undefined,
    expected: string | string[],
  ): Promise<AgencyRow | null> {
    const expectedList = Array.isArray(expected) ? expected : [expected];
    const res = await this.db.query(
      `UPDATE bds_agencies
       SET status = $2,
           tier_id = COALESCE($3, tier_id),
           updated_at = NOW()
       WHERE id = $1 AND status = ANY($4::text[])
       RETURNING *`,
      [id, status, extra?.tier_id ?? null, expectedList],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapAgency(row) : null;
  }

  async setAgencyTier(
    id: string,
    tierId: string,
    override: { reason: string; until?: Date | null },
  ): Promise<AgencyRow> {
    const res = await this.db.query(
      `UPDATE bds_agencies
       SET tier_id = $2,
           tier_override = TRUE,
           tier_override_reason = $3,
           tier_override_until = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, tierId, override.reason, override.until ?? null],
    );
    return this.mapAgency(res.rows[0] as Record<string, unknown>);
  }

  async insertContract(row: {
    agency_id: string;
    project_id: number;
    status?: string;
    max_concurrent_holds?: number | null;
  }): Promise<ContractRow> {
    try {
      const res = await this.db.query(
        `INSERT INTO bds_agency_contracts (agency_id, project_id, status, max_concurrent_holds)
         VALUES ($1,$2,$3,$4)
         RETURNING *`,
        [
          row.agency_id,
          row.project_id,
          row.status ?? 'active',
          row.max_concurrent_holds ?? null,
        ],
      );
      return this.mapContract(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw { code: '23505' };
      }
      throw err;
    }
  }

  async getActiveContract(agencyId: string, projectId: number): Promise<ContractRow | null> {
    const res = await this.db.query(
      `SELECT * FROM bds_agency_contracts
       WHERE agency_id = $1 AND project_id = $2 AND status = 'active'
       LIMIT 1`,
      [agencyId, projectId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapContract(row) : null;
  }

  async getOrCreateRule(agencyId: string, projectId: number): Promise<BasketRuleRow> {
    const existing = await this.db.query(
      `SELECT * FROM bds_basket_rules
       WHERE agency_id = $1 AND project_id = $2 AND status = 'active'
       LIMIT 1`,
      [agencyId, projectId],
    );
    const found = existing.rows[0] as Record<string, unknown> | undefined;
    if (found) return this.mapRule(found);

    const res = await this.db.query(
      `INSERT INTO bds_basket_rules (agency_id, project_id, scope_type, exclusivity, status)
       VALUES ($1,$2,'units','shared','active')
       RETURNING *`,
      [agencyId, projectId],
    );
    return this.mapRule(res.rows[0] as Record<string, unknown>);
  }

  async grantUnit(row: {
    rule_id: string;
    agency_id: string;
    project_id: number;
    product_id: number;
    exclusivity: string;
    granted_by?: string;
  }): Promise<BasketUnitRow> {
    try {
      const res = await this.db.query(
        `INSERT INTO bds_basket_units (
           rule_id, agency_id, project_id, product_id, exclusivity, granted_by
         ) VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [
          row.rule_id,
          row.agency_id,
          row.project_id,
          row.product_id,
          row.exclusivity,
          String(row.granted_by ?? ''),
        ],
      );
      return this.mapBasketUnit(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw { code: '23505' };
      }
      throw err;
    }
  }

  async getOpenUnit(agencyId: string, productId: number): Promise<BasketUnitRow | null> {
    const res = await this.db.query(
      `SELECT * FROM bds_basket_units
       WHERE agency_id = $1 AND product_id = $2 AND revoked_at IS NULL
       LIMIT 1`,
      [agencyId, productId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapBasketUnit(row) : null;
  }

  async listOpenUnits(agencyId: string, projectId?: number): Promise<BasketUnitRow[]> {
    const params: unknown[] = [agencyId];
    let sql = `SELECT * FROM bds_basket_units WHERE agency_id = $1 AND revoked_at IS NULL`;
    if (projectId != null) {
      params.push(projectId);
      sql += ` AND project_id = $2`;
    }
    sql += ` ORDER BY granted_at DESC`;
    const res = await this.db.query(sql, params);
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapBasketUnit(row));
  }

  async revokeUnit(id: string, reason: string, now: Date): Promise<BasketUnitRow | null> {
    const res = await this.db.query(
      `UPDATE bds_basket_units
       SET revoked_at = $2, revoke_reason = $3
       WHERE id = $1 AND revoked_at IS NULL
       RETURNING *`,
      [id, now, reason],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapBasketUnit(row) : null;
  }

  async countOpenHolds(agencyId: string): Promise<number> {
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS cnt FROM bds_holds
       WHERE channel_partner_id = $1 AND status IN ('pending', 'active')`,
      [agencyId],
    );
    return Number((res.rows[0] as { cnt?: number }).cnt ?? 0);
  }

  async resolveProjectTenantId(projectId: number): Promise<string | null> {
    const res = await this.db.query(
      `SELECT tenant_id FROM crm_re_projects WHERE id = $1`,
      [projectId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row?.tenant_id != null ? String(row.tenant_id) : null;
  }

  async getProjectOnePrice(projectId: number): Promise<boolean | null> {
    const res = await this.db.query(
      `SELECT one_price FROM crm_re_projects WHERE id = $1`,
      [projectId],
    );
    if (!res.rows[0]) return null;
    return Boolean((res.rows[0] as Record<string, unknown>).one_price);
  }

  async getUnitPool(
    productId: number,
  ): Promise<{ project_id: number; pool: string; status: string; hold_id: string | null } | null> {
    const res = await this.db.query(
      `SELECT project_id, pool, status, hold_id FROM crm_re_project_products WHERE id = $1`,
      [productId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      project_id: Number(row.project_id),
      pool: String(row.pool ?? 'inhouse'),
      status: String(row.status ?? ''),
      hold_id: row.hold_id != null ? String(row.hold_id) : null,
    };
  }
}
