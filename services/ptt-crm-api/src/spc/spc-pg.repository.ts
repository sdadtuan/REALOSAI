import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  SpcFamilyDetail,
  SpcFamilyRow,
  SpcOfferDetail,
  SpcOfferRow,
  SpcOfferLineRow,
  SpcPatchOfferBody,
  SpcPortfolioItem,
  SpcPricingModel,
  SpcProcessPhaseRow,
  SpcPublishLogRow,
  SpcPutProcessPhaseBody,
  SpcComponentRow,
  SpcCreateComponentBody,
  SpcPatchComponentBody,
  SpcBundleItemRow,
  SpcPutOfferBundleBody,
} from './spc.types';

function iso(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function mapFamily(row: Record<string, unknown>): SpcFamilyRow {
  return {
    dv_code: String(row.dv_code ?? ''),
    name_vi: String(row.name_vi ?? ''),
    department: String(row.department ?? ''),
    role_vi: String(row.role_vi ?? ''),
    service_type: String(row.service_type ?? ''),
    description_vi: String(row.description_vi ?? ''),
    risks_json: parseJson(row.risks_json, []),
    depends_on_dv: parseJson(row.depends_on_dv, []),
    readiness: String(row.readiness ?? 'partial'),
    sort_order: Number(row.sort_order ?? 0),
    active: row.active !== false,
    updated_at: iso(row.updated_at),
  };
}

function mapOffer(row: Record<string, unknown>): SpcOfferRow {
  const draftPricing = row.draft_pricing_model != null ? parseJson(row.draft_pricing_model, null) : null;
  const draftScope =
    row.draft_scope_summary_vi != null ? String(row.draft_scope_summary_vi) : null;
  return {
    sku_code: String(row.sku_code ?? ''),
    dv_code: String(row.dv_code ?? ''),
    tier: String(row.tier ?? 'TC') as SpcOfferRow['tier'],
    label_vi: String(row.label_vi ?? ''),
    scope_summary_vi: String(row.scope_summary_vi ?? ''),
    pricing_model: parseJson(row.pricing_model, {}),
    duration_hint_vi: String(row.duration_hint_vi ?? ''),
    status: String(row.status ?? 'draft') as SpcOfferRow['status'],
    published_version: Number(row.published_version ?? 0),
    draft_pricing_model: draftPricing as SpcPricingModel | null,
    draft_scope_summary_vi: draftScope,
    has_pending_draft: draftPricing != null || (draftScope != null && draftScope.length > 0),
    sort_order: Number(row.sort_order ?? 0),
    active: row.active !== false,
    updated_at: iso(row.updated_at),
  };
}

function mapProcessPhase(row: Record<string, unknown>): SpcProcessPhaseRow {
  return {
    phase_code: String(row.phase_code ?? ''),
    dv_code: String(row.dv_code ?? ''),
    sku_code: row.sku_code != null ? String(row.sku_code) : null,
    week_label_vi: String(row.week_label_vi ?? ''),
    ptt_work_vi: String(row.ptt_work_vi ?? ''),
    deliverable_vi: String(row.deliverable_vi ?? ''),
    client_action_vi: String(row.client_action_vi ?? ''),
    tasks_json: parseJson(row.tasks_json, []),
    sort_order: Number(row.sort_order ?? 0),
    active: row.active !== false,
    updated_at: iso(row.updated_at),
  };
}

function mapComponent(row: Record<string, unknown>): SpcComponentRow {
  const draftPricing =
    row.draft_pricing_model != null ? parseJson(row.draft_pricing_model, null) : null;
  const draftName = row.draft_name_vi != null ? String(row.draft_name_vi) : null;
  const draftDescription =
    row.draft_description_vi != null ? String(row.draft_description_vi) : null;
  const draftDeliverable =
    row.draft_deliverable_vi != null ? String(row.draft_deliverable_vi) : null;
  return {
    component_code: String(row.component_code ?? ''),
    dv_code: String(row.dv_code ?? ''),
    name_vi: String(row.name_vi ?? ''),
    description_vi: String(row.description_vi ?? ''),
    deliverable_vi: String(row.deliverable_vi ?? ''),
    pricing_model: parseJson(row.pricing_model, {}),
    unit: String(row.unit ?? 'once'),
    sort_order: Number(row.sort_order ?? 0),
    active: row.active !== false,
    status: String(row.status ?? 'draft') as SpcComponentRow['status'],
    published_version: Number(row.published_version ?? 0),
    draft_pricing_model: draftPricing as SpcPricingModel | null,
    draft_name_vi: draftName,
    draft_description_vi: draftDescription,
    draft_deliverable_vi: draftDeliverable,
    has_pending_draft:
      draftPricing != null ||
      (draftName != null && draftName.length > 0) ||
      (draftDescription != null && draftDescription.length > 0) ||
      (draftDeliverable != null && draftDeliverable.length > 0),
    updated_at: iso(row.updated_at),
  };
}

@Injectable()
export class SpcPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      if (!this.config.databaseUrl) {
        throw new Error('spc_pg_requires_database_url');
      }
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  canUsePg(): boolean {
    return Boolean(this.config.databaseUrl?.trim());
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async listPortfolio(includeDrafts: boolean): Promise<SpcPortfolioItem[]> {
    const statusFilter = includeDrafts ? '' : "AND o.status = 'published'";
    const { rows } = await this.db.query(`
      SELECT
        f.dv_code,
        f.name_vi,
        f.department,
        f.readiness,
        f.service_type,
        COUNT(o.sku_code)::int AS offer_count,
        COUNT(o.sku_code) FILTER (WHERE o.status = 'published')::int AS published_count,
        COUNT(o.sku_code) FILTER (WHERE o.status = 'draft' OR o.draft_pricing_model IS NOT NULL OR NULLIF(o.draft_scope_summary_vi, '') IS NOT NULL)::int AS draft_count
      FROM service_family f
      LEFT JOIN service_offer o ON o.dv_code = f.dv_code AND o.active = TRUE ${statusFilter}
      WHERE f.active = TRUE
      GROUP BY f.dv_code, f.name_vi, f.department, f.readiness, f.service_type, f.sort_order
      ORDER BY f.sort_order, f.dv_code
    `);
    return rows.map((row) => ({
      dv_code: String(row.dv_code),
      name_vi: String(row.name_vi),
      department: String(row.department ?? ''),
      readiness: String(row.readiness ?? 'partial'),
      service_type: String(row.service_type ?? ''),
      offer_count: Number(row.offer_count ?? 0),
      published_count: Number(row.published_count ?? 0),
      draft_count: Number(row.draft_count ?? 0),
    }));
  }

  async getFamily(dvCode: string, publishedOnly: boolean): Promise<SpcFamilyDetail | null> {
    const { rows } = await this.db.query(
      `SELECT * FROM service_family WHERE dv_code = $1 AND active = TRUE LIMIT 1`,
      [dvCode],
    );
    if (!rows[0]) return null;
    const family = mapFamily(rows[0] as Record<string, unknown>);
    const offerWhere = publishedOnly ? "AND status = 'published'" : '';
    const offersRes = await this.db.query(
      `SELECT * FROM service_offer WHERE dv_code = $1 AND active = TRUE ${offerWhere} ORDER BY sort_order, tier`,
      [dvCode],
    );
    const counts = await this.db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM service_process_phase WHERE dv_code = $1 AND active = TRUE) AS phases,
         (SELECT COUNT(*)::int FROM service_kpi_def WHERE dv_code = $1) AS kpis,
         (SELECT COUNT(*)::int FROM service_component WHERE dv_code = $1 AND active = TRUE) AS components`,
      [dvCode],
    );
    return {
      ...family,
      offers: offersRes.rows.map((r) => mapOffer(r as Record<string, unknown>)),
      phase_count: Number(counts.rows[0]?.phases ?? 0),
      kpi_count: Number(counts.rows[0]?.kpis ?? 0),
      component_count: Number(counts.rows[0]?.components ?? 0),
    };
  }

  async getOffer(skuCode: string, publishedOnly: boolean): Promise<SpcOfferDetail | null> {
    const statusClause = publishedOnly ? "AND status = 'published'" : '';
    const { rows } = await this.db.query(
      `SELECT * FROM service_offer WHERE sku_code = $1 AND active = TRUE ${statusClause} LIMIT 1`,
      [skuCode],
    );
    if (!rows[0]) return null;
    const offer = mapOffer(rows[0] as Record<string, unknown>);
    const linesRes = await this.db.query(
      `SELECT * FROM service_offer_line WHERE sku_code = $1 AND active = TRUE ORDER BY sort_order, line_code`,
      [skuCode],
    );
    return {
      ...offer,
      lines: linesRes.rows.map((line) => ({
        line_code: String(line.line_code),
        sku_code: String(line.sku_code),
        label_vi: String(line.label_vi ?? ''),
        description_vi: String(line.description_vi ?? ''),
        unit: String(line.unit ?? 'once'),
        included_by_default: line.included_by_default !== false,
        sort_order: Number(line.sort_order ?? 0),
        active: line.active !== false,
        component_code: line.component_code != null ? String(line.component_code) : null,
      })),
    };
  }

  async listOffersByDv(dvCode: string, publishedOnly: boolean): Promise<SpcOfferRow[]> {
    const statusClause = publishedOnly ? "AND status = 'published'" : '';
    const { rows } = await this.db.query(
      `SELECT * FROM service_offer WHERE dv_code = $1 AND active = TRUE ${statusClause} ORDER BY sort_order, tier`,
      [dvCode],
    );
    return rows.map((r) => mapOffer(r as Record<string, unknown>));
  }

  async patchOffer(skuCode: string, body: SpcPatchOfferBody): Promise<SpcOfferRow | null> {
    const existingRes = await this.db.query(
      `SELECT * FROM service_offer WHERE sku_code = $1 AND active = TRUE LIMIT 1`,
      [skuCode],
    );
    if (!existingRes.rows[0]) return null;
    const existing = mapOffer(existingRes.rows[0] as Record<string, unknown>);

    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let i = 1;

    if (body.label_vi != null) {
      sets.push(`label_vi = $${i++}`);
      params.push(body.label_vi);
    }
    if (body.duration_hint_vi != null) {
      sets.push(`duration_hint_vi = $${i++}`);
      params.push(body.duration_hint_vi);
    }

    const hasPublished = existing.published_version > 0 || existing.status === 'published';
    if (hasPublished) {
      if (body.scope_summary_vi != null) {
        sets.push(`draft_scope_summary_vi = $${i++}`);
        params.push(body.scope_summary_vi);
      }
      if (body.pricing_model != null) {
        sets.push(`draft_pricing_model = $${i++}::jsonb`);
        params.push(JSON.stringify(body.pricing_model));
      }
    } else {
      if (body.scope_summary_vi != null) {
        sets.push(`scope_summary_vi = $${i++}`);
        params.push(body.scope_summary_vi);
      }
      if (body.pricing_model != null) {
        sets.push(`pricing_model = $${i++}::jsonb`);
        params.push(JSON.stringify(body.pricing_model));
      }
      sets.push(`status = 'draft'`);
    }

    params.push(skuCode);
    const { rows } = await this.db.query(
      `UPDATE service_offer SET ${sets.join(', ')} WHERE sku_code = $${i} AND active = TRUE RETURNING *`,
      params,
    );
    return rows[0] ? mapOffer(rows[0] as Record<string, unknown>) : null;
  }

  async publishOffer(skuCode: string, actorEmail: string): Promise<SpcOfferRow | null> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query(`SELECT * FROM service_offer WHERE sku_code = $1 FOR UPDATE`, [skuCode]);
      if (!cur.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      const before = mapOffer(cur.rows[0] as Record<string, unknown>);
      const nextVersion = before.published_version + 1;
      const mergedPricing =
        before.draft_pricing_model && Object.keys(before.draft_pricing_model).length
          ? before.draft_pricing_model
          : before.pricing_model;
      const mergedScope = before.draft_scope_summary_vi ?? before.scope_summary_vi;
      const { rows } = await client.query(
        `UPDATE service_offer
         SET status = 'published',
             published_version = $2,
             pricing_model = $3::jsonb,
             scope_summary_vi = $4,
             draft_pricing_model = NULL,
             draft_scope_summary_vi = NULL,
             updated_at = NOW()
         WHERE sku_code = $1
         RETURNING *`,
        [skuCode, nextVersion, JSON.stringify(mergedPricing), mergedScope],
      );
      const after = mapOffer(rows[0] as Record<string, unknown>);
      await client.query(
        `INSERT INTO spc_publish_log (entity_type, entity_key, action, from_version, to_version, actor_email, diff_json)
         VALUES ('offer', $1, 'publish', $2, $3, $4, $5::jsonb)`,
        [
          skuCode,
          before.published_version,
          nextVersion,
          actorEmail,
          JSON.stringify({ pricing_model: after.pricing_model, status: after.status }),
        ],
      );
      await client.query('COMMIT');
      return after;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async syncOpsProfileTierPricing(dvCode: string, tierPricing: Record<string, unknown>): Promise<void> {
    await this.db.query(
      `UPDATE ops_service_profile SET tier_pricing = $2::jsonb, updated_at = NOW() WHERE dv_code = $1`,
      [dvCode, JSON.stringify(tierPricing)],
    );
  }

  async countDraftOffers(): Promise<number> {
    const { rows } = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM service_offer
       WHERE active = TRUE
         AND (
           status = 'draft'
           OR draft_pricing_model IS NOT NULL
           OR NULLIF(draft_scope_summary_vi, '') IS NOT NULL
         )`,
    );
    return Number(rows[0]?.n ?? 0);
  }

  async countDraftComponents(): Promise<number> {
    const { rows } = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM service_component
       WHERE active = TRUE
         AND (
           status = 'draft'
           OR draft_pricing_model IS NOT NULL
           OR NULLIF(draft_name_vi, '') IS NOT NULL
           OR NULLIF(draft_description_vi, '') IS NOT NULL
           OR NULLIF(draft_deliverable_vi, '') IS NOT NULL
         )`,
    );
    return Number(rows[0]?.n ?? 0);
  }

  async listPublishLog(limit = 50): Promise<SpcPublishLogRow[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM spc_publish_log ORDER BY created_at DESC, id DESC LIMIT $1`,
      [limit],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      entity_type: String(row.entity_type),
      entity_key: String(row.entity_key),
      action: String(row.action),
      from_version: row.from_version != null ? Number(row.from_version) : null,
      to_version: row.to_version != null ? Number(row.to_version) : null,
      actor_email: String(row.actor_email),
      diff_json: parseJson(row.diff_json, {}),
      created_at: iso(row.created_at),
    }));
  }

  async listPublishedOffersForCatalog(): Promise<
    Array<SpcOfferRow & { lines_count: number }>
  > {
    const { rows } = await this.db.query(`
      SELECT o.*, COUNT(l.line_code)::int AS lines_count
      FROM service_offer o
      LEFT JOIN service_offer_line l ON l.sku_code = o.sku_code AND l.active = TRUE
      WHERE o.status = 'published' AND o.active = TRUE
      GROUP BY o.sku_code
      ORDER BY o.dv_code, o.sort_order, o.tier
    `);
    return rows.map((row) => ({
      ...mapOffer(row as Record<string, unknown>),
      lines_count: Number(row.lines_count ?? 0),
    }));
  }

  async listQuoteCatalogRows(): Promise<
    Array<{
      family: SpcFamilyRow;
      offers: Array<SpcOfferRow & { lines: SpcOfferLineRow[] }>;
      default_sku_code: string | null;
      service_slug: string | null;
    }>
  > {
    const familiesRes = await this.db.query(`
      SELECT * FROM service_family WHERE active = TRUE ORDER BY sort_order, dv_code
    `);
    const offersRes = await this.db.query(`
      SELECT o.* FROM service_offer o
      WHERE o.status = 'published' AND o.active = TRUE
      ORDER BY o.dv_code, o.sort_order, o.tier
    `);
    const linesRes = await this.db.query(`
      SELECT * FROM service_offer_line WHERE active = TRUE ORDER BY sku_code, sort_order, line_code
    `);
    const slugRes = await this.db.query(`
      SELECT dv_code, default_sku_code, slug FROM crm_catalog_services WHERE dv_code IS NOT NULL
    `);
    const slugByDv = new Map<string, { default_sku_code: string | null; slug: string | null }>();
    for (const row of slugRes.rows) {
      slugByDv.set(String(row.dv_code), {
        default_sku_code: row.default_sku_code != null ? String(row.default_sku_code) : null,
        slug: row.slug != null ? String(row.slug) : null,
      });
    }
    const linesBySku = new Map<string, SpcOfferLineRow[]>();
    for (const row of linesRes.rows) {
      const sku = String(row.sku_code);
      const list = linesBySku.get(sku) ?? [];
      list.push({
        line_code: String(row.line_code),
        sku_code: sku,
        label_vi: String(row.label_vi ?? ''),
        description_vi: String(row.description_vi ?? ''),
        unit: String(row.unit ?? 'once'),
        included_by_default: row.included_by_default !== false,
        sort_order: Number(row.sort_order ?? 0),
        active: row.active !== false,
        component_code: row.component_code != null ? String(row.component_code) : null,
      });
      linesBySku.set(sku, list);
    }
    const offersByDv = new Map<string, Array<SpcOfferRow & { lines: SpcOfferLineRow[] }>>();
    for (const row of offersRes.rows) {
      const offer = mapOffer(row as Record<string, unknown>);
      const list = offersByDv.get(offer.dv_code) ?? [];
      list.push({ ...offer, lines: linesBySku.get(offer.sku_code) ?? [] });
      offersByDv.set(offer.dv_code, list);
    }
    return familiesRes.rows.map((row) => {
      const family = mapFamily(row as Record<string, unknown>);
      const meta = slugByDv.get(family.dv_code);
      return {
        family,
        offers: offersByDv.get(family.dv_code) ?? [],
        default_sku_code: meta?.default_sku_code ?? `${family.dv_code}-TC`,
        service_slug: meta?.slug ?? null,
      };
    });
  }

  async listProcessPhases(dvCode?: string): Promise<SpcProcessPhaseRow[]> {
    const code = String(dvCode ?? '').trim().toUpperCase();
    const res = code
      ? await this.db.query(
          `SELECT * FROM service_process_phase WHERE dv_code = $1 ORDER BY sort_order, phase_code`,
          [code],
        )
      : await this.db.query(
          `SELECT * FROM service_process_phase ORDER BY dv_code, sort_order, phase_code`,
        );
    return res.rows.map((row) => mapProcessPhase(row as Record<string, unknown>));
  }

  async getProcessPhase(phaseCode: string): Promise<SpcProcessPhaseRow | null> {
    const code = String(phaseCode ?? '').trim().toUpperCase();
    const res = await this.db.query(`SELECT * FROM service_process_phase WHERE phase_code = $1`, [code]);
    const row = res.rows[0];
    return row ? mapProcessPhase(row as Record<string, unknown>) : null;
  }

  async putProcessPhase(
    phaseCode: string,
    body: SpcPutProcessPhaseBody,
  ): Promise<SpcProcessPhaseRow | null> {
    const code = String(phaseCode ?? '').trim().toUpperCase();
    const existing = await this.getProcessPhase(code);
    if (!existing) return null;

    const weekLabel =
      body.week_label_vi != null ? String(body.week_label_vi) : existing.week_label_vi;
    const pttWork = body.ptt_work_vi != null ? String(body.ptt_work_vi) : existing.ptt_work_vi;
    const deliverable =
      body.deliverable_vi != null ? String(body.deliverable_vi) : existing.deliverable_vi;
    const clientAction =
      body.client_action_vi != null ? String(body.client_action_vi) : existing.client_action_vi;
    const tasksJson = body.tasks_json != null ? body.tasks_json : existing.tasks_json;
    const sortOrder = body.sort_order != null ? Number(body.sort_order) : existing.sort_order;
    const active = body.active != null ? Boolean(body.active) : existing.active;

    const res = await this.db.query(
      `UPDATE service_process_phase
       SET week_label_vi = $2,
           ptt_work_vi = $3,
           deliverable_vi = $4,
           client_action_vi = $5,
           tasks_json = $6::jsonb,
           sort_order = $7,
           active = $8
       WHERE phase_code = $1
       RETURNING *`,
      [code, weekLabel, pttWork, deliverable, clientAction, JSON.stringify(tasksJson), sortOrder, active],
    );
    const row = res.rows[0];
    return row ? mapProcessPhase(row as Record<string, unknown>) : null;
  }

  async listComponents(
    dvCode?: string,
    activeOnly = true,
    publishedOnly = false,
  ): Promise<SpcComponentRow[]> {
    const code = String(dvCode ?? '').trim().toUpperCase();
    const activeClause = activeOnly ? 'AND active = TRUE' : '';
    const statusClause = publishedOnly ? "AND status = 'published'" : '';
    const res = code
      ? await this.db.query(
          `SELECT * FROM service_component WHERE dv_code = $1 ${activeClause} ${statusClause} ORDER BY sort_order, component_code`,
          [code],
        )
      : await this.db.query(
          `SELECT * FROM service_component WHERE 1=1 ${activeClause} ${statusClause} ORDER BY dv_code, sort_order, component_code`,
        );
    return res.rows.map((row) => mapComponent(row as Record<string, unknown>));
  }

  async getComponent(componentCode: string): Promise<SpcComponentRow | null> {
    const code = String(componentCode ?? '').trim().toUpperCase();
    const res = await this.db.query(`SELECT * FROM service_component WHERE component_code = $1`, [code]);
    const row = res.rows[0];
    return row ? mapComponent(row as Record<string, unknown>) : null;
  }

  async nextComponentCode(dvCode: string): Promise<string> {
    const dv = String(dvCode ?? '').trim().toUpperCase();
    const res = await this.db.query(
      `SELECT component_code FROM service_component WHERE dv_code = $1 ORDER BY component_code DESC LIMIT 1`,
      [dv],
    );
    const last = String(res.rows[0]?.component_code ?? '');
    const match = last.match(new RegExp(`^${dv}-C(\\d+)$`, 'i'));
    const next = match ? Number(match[1]) + 1 : 1;
    return `${dv}-C${String(next).padStart(2, '0')}`;
  }

  async createComponent(body: SpcCreateComponentBody): Promise<SpcComponentRow> {
    const dvCode = String(body.dv_code ?? '').trim().toUpperCase();
    const componentCode =
      String(body.component_code ?? '').trim().toUpperCase() || (await this.nextComponentCode(dvCode));
    const res = await this.db.query(
      `INSERT INTO service_component
         (component_code, dv_code, name_vi, description_vi, deliverable_vi, pricing_model, unit, sort_order, status)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,'draft')
       RETURNING *`,
      [
        componentCode,
        dvCode,
        String(body.name_vi ?? '').trim(),
        String(body.description_vi ?? ''),
        String(body.deliverable_vi ?? ''),
        JSON.stringify(body.pricing_model ?? { type: 'one_time', min_vnd: 0, max_vnd: 0 }),
        String(body.unit ?? 'once'),
        Number(body.sort_order ?? 0),
      ],
    );
    return mapComponent(res.rows[0] as Record<string, unknown>);
  }

  async patchComponent(
    componentCode: string,
    body: SpcPatchComponentBody,
  ): Promise<SpcComponentRow | null> {
    const code = String(componentCode ?? '').trim().toUpperCase();
    const existingRes = await this.db.query(
      `SELECT * FROM service_component WHERE component_code = $1 LIMIT 1`,
      [code],
    );
    if (!existingRes.rows[0]) return null;
    const existing = mapComponent(existingRes.rows[0] as Record<string, unknown>);

    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let i = 1;

    if (body.unit != null) {
      sets.push(`unit = $${i++}`);
      params.push(String(body.unit));
    }
    if (body.sort_order != null) {
      sets.push(`sort_order = $${i++}`);
      params.push(Number(body.sort_order));
    }
    if (body.active != null) {
      sets.push(`active = $${i++}`);
      params.push(Boolean(body.active));
    }

    const hasPublished = (existing.published_version ?? 0) > 0 || existing.status === 'published';
    if (hasPublished) {
      if (body.name_vi != null) {
        sets.push(`draft_name_vi = $${i++}`);
        params.push(String(body.name_vi));
      }
      if (body.description_vi != null) {
        sets.push(`draft_description_vi = $${i++}`);
        params.push(String(body.description_vi));
      }
      if (body.deliverable_vi != null) {
        sets.push(`draft_deliverable_vi = $${i++}`);
        params.push(String(body.deliverable_vi));
      }
      if (body.pricing_model != null) {
        sets.push(`draft_pricing_model = $${i++}::jsonb`);
        params.push(JSON.stringify(body.pricing_model));
      }
    } else {
      if (body.name_vi != null) {
        sets.push(`name_vi = $${i++}`);
        params.push(String(body.name_vi));
      }
      if (body.description_vi != null) {
        sets.push(`description_vi = $${i++}`);
        params.push(String(body.description_vi));
      }
      if (body.deliverable_vi != null) {
        sets.push(`deliverable_vi = $${i++}`);
        params.push(String(body.deliverable_vi));
      }
      if (body.pricing_model != null) {
        sets.push(`pricing_model = $${i++}::jsonb`);
        params.push(JSON.stringify(body.pricing_model));
      }
      sets.push(`status = 'draft'`);
    }

    params.push(code);
    const res = await this.db.query(
      `UPDATE service_component SET ${sets.join(', ')} WHERE component_code = $${i} RETURNING *`,
      params,
    );
    const row = res.rows[0];
    return row ? mapComponent(row as Record<string, unknown>) : null;
  }

  async publishComponent(componentCode: string, actorEmail: string): Promise<SpcComponentRow | null> {
    const code = String(componentCode ?? '').trim().toUpperCase();
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query(`SELECT * FROM service_component WHERE component_code = $1 FOR UPDATE`, [
        code,
      ]);
      if (!cur.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      const before = mapComponent(cur.rows[0] as Record<string, unknown>);
      const nextVersion = (before.published_version ?? 0) + 1;
      const mergedPricing =
        before.draft_pricing_model && Object.keys(before.draft_pricing_model).length
          ? before.draft_pricing_model
          : before.pricing_model;
      const mergedName = before.draft_name_vi ?? before.name_vi;
      const mergedDescription = before.draft_description_vi ?? before.description_vi;
      const mergedDeliverable = before.draft_deliverable_vi ?? before.deliverable_vi;
      const { rows } = await client.query(
        `UPDATE service_component
         SET status = 'published',
             published_version = $2,
             name_vi = $3,
             description_vi = $4,
             deliverable_vi = $5,
             pricing_model = $6::jsonb,
             draft_pricing_model = NULL,
             draft_name_vi = NULL,
             draft_description_vi = NULL,
             draft_deliverable_vi = NULL,
             updated_at = NOW()
         WHERE component_code = $1
         RETURNING *`,
        [
          code,
          nextVersion,
          mergedName,
          mergedDescription,
          mergedDeliverable,
          JSON.stringify(mergedPricing),
        ],
      );
      const after = mapComponent(rows[0] as Record<string, unknown>);
      await client.query(
        `INSERT INTO spc_publish_log (entity_type, entity_key, action, from_version, to_version, actor_email, diff_json)
         VALUES ('component', $1, 'publish', $2, $3, $4, $5::jsonb)`,
        [
          code,
          before.published_version,
          nextVersion,
          actorEmail,
          JSON.stringify({ pricing_model: after.pricing_model, status: after.status }),
        ],
      );
      await client.query('COMMIT');
      return after;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listBundleItems(skuCode: string): Promise<SpcBundleItemRow[]> {
    const sku = String(skuCode ?? '').trim().toUpperCase();
    const res = await this.db.query(
      `SELECT b.*, c.name_vi, c.pricing_model
       FROM service_bundle_item b
       JOIN service_component c ON c.component_code = b.component_code
       WHERE b.sku_code = $1
       ORDER BY b.sort_order, b.component_code`,
      [sku],
    );
    return res.rows.map((row) => ({
      sku_code: String(row.sku_code),
      component_code: String(row.component_code),
      included: row.included !== false,
      qty: Number(row.qty ?? 1),
      price_override_vnd: row.price_override_vnd != null ? Number(row.price_override_vnd) : null,
      sort_order: Number(row.sort_order ?? 0),
      name_vi: String(row.name_vi ?? ''),
      pricing_model: parseJson(row.pricing_model, {}),
    }));
  }

  async replaceBundleItems(skuCode: string, body: SpcPutOfferBundleBody): Promise<SpcBundleItemRow[]> {
    const sku = String(skuCode ?? '').trim().toUpperCase();
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM service_bundle_item WHERE sku_code = $1`, [sku]);
      let order = 0;
      for (const item of body.items ?? []) {
        order += 1;
        await client.query(
          `INSERT INTO service_bundle_item
             (sku_code, component_code, included, qty, price_override_vnd, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            sku,
            String(item.component_code ?? '').trim().toUpperCase(),
            item.included !== false,
            Math.max(1, Number(item.qty ?? 1)),
            item.price_override_vnd != null ? Number(item.price_override_vnd) : null,
            Number(item.sort_order ?? order),
          ],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return this.listBundleItems(sku);
  }

  async withClient<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
    const client = await this.db.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }
}
