import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  SALES_PIPELINE_LABELS_VI,
  SALES_PIPELINE_STAGES,
  STAGE_OWNER_ROLE,
  STAGE_SLA_HOURS,
  TERMINAL_STAGES,
} from '../sales/sales-pipeline.util';
import {
  DEFAULT_LEAD_CHANNELS,
  DEFAULT_LEAD_SOURCES,
  DEFAULT_SALES_PIPELINE_KEY,
  defaultSalesPipelineStages,
} from './crm-config.defaults';
import { mapCustomField, mapLeadLookup, mapPipelineStage } from './crm-config-pg.mapper';
import type {
  CreateCustomFieldBody,
  CreateLeadLookupBody,
  CreatePipelineStageBody,
  CustomFieldDef,
  CustomFieldEntityType,
  CustomFieldType,
  LeadLookupKind,
  LeadLookupOption,
  PatchPipelineStageBody,
  PipelineStageDef,
  SalesPipelineConfig,
  UpdateCustomFieldBody,
  UpdateLeadLookupBody,
  UpdatePipelineStagesBody,
} from './crm-config.types';

const ENTITY_TYPES = new Set<CustomFieldEntityType>(['lead', 'customer', 'case']);
const FIELD_TYPES = new Set<CustomFieldType>(['text', 'number', 'select', 'date', 'boolean']);
const LEAD_LOOKUP_KINDS = new Set<LeadLookupKind>(['source', 'channel']);

function slugKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === '23505';
}

function parseExistingOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    if (Array.isArray(parsed)) return parsed.map((v) => String(v));
  } catch {
    /* ignore */
  }
  return [];
}

@Injectable()
export class CrmConfigPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private seeded = false;

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

  private async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    await this.seedDefaultPipelineIfEmpty();
    await this.seedDefaultLeadLookupsIfEmpty();
    this.seeded = true;
  }

  private async seedDefaultPipelineIfEmpty(): Promise<void> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM crm_pipeline_stages
       WHERE pipeline_key = $1 AND active = TRUE`,
      [DEFAULT_SALES_PIPELINE_KEY],
    );
    if (Number(result.rows[0]?.n ?? 0) > 0) return;
    const ts = catalogTs();
    for (const stage of defaultSalesPipelineStages()) {
      await this.db.query(
        `INSERT INTO crm_pipeline_stages
          (pipeline_key, stage_key, label, sort_order, sla_hours, owner_role, is_terminal, active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8::timestamptz)`,
        [
          DEFAULT_SALES_PIPELINE_KEY,
          stage.stage_key,
          stage.label,
          stage.sort_order,
          stage.sla_hours,
          stage.owner_role,
          stage.is_terminal,
          ts,
        ],
      );
    }
  }

  private async seedDefaultLeadLookupsIfEmpty(): Promise<void> {
    for (const kind of ['source', 'channel'] as LeadLookupKind[]) {
      const result = await this.db.query(
        `SELECT COUNT(*)::int AS n FROM crm_lead_lookup_options WHERE kind = $1`,
        [kind],
      );
      if (Number(result.rows[0]?.n ?? 0) > 0) continue;
      const ts = catalogTs();
      const defaults = kind === 'source' ? DEFAULT_LEAD_SOURCES : DEFAULT_LEAD_CHANNELS;
      for (let index = 0; index < defaults.length; index++) {
        const item = defaults[index];
        await this.db.query(
          `INSERT INTO crm_lead_lookup_options
            (kind, option_key, label, sort_order, active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, TRUE, $5::timestamptz, $5::timestamptz)`,
          [kind, item.option_key, item.label, index, ts],
        );
      }
    }
  }

  private async resolveCustomFieldPgId(
    legacyId: number,
  ): Promise<{ pgId: number; legacyId: number } | null> {
    const result = await this.db.query(
      `SELECT id, sqlite_field_id FROM crm_custom_field_defs
       WHERE sqlite_field_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_field_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown; sqlite_field_id?: unknown } | undefined;
    if (!row?.id) return null;
    return {
      pgId: Number(row.id),
      legacyId: Number(row.sqlite_field_id ?? row.id),
    };
  }

  private async resolveLeadLookupPgId(
    legacyId: number,
  ): Promise<{ pgId: number; legacyId: number } | null> {
    const result = await this.db.query(
      `SELECT id, sqlite_lookup_id FROM crm_lead_lookup_options
       WHERE sqlite_lookup_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_lookup_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown; sqlite_lookup_id?: unknown } | undefined;
    if (!row?.id) return null;
    return {
      pgId: Number(row.id),
      legacyId: Number(row.sqlite_lookup_id ?? row.id),
    };
  }

  async listLeadLookups(kind?: LeadLookupKind, activeOnly = false): Promise<LeadLookupOption[]> {
    await this.ensureSeeded();
    const params: unknown[] = [];
    const clauses: string[] = [];
    let paramIdx = 1;
    if (kind) {
      if (!LEAD_LOOKUP_KINDS.has(kind)) {
        throw new BadRequestException({ error: 'invalid_lookup_kind' });
      }
      clauses.push(`kind = $${paramIdx++}`);
      params.push(kind);
    }
    if (activeOnly) {
      clauses.push('active = TRUE');
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.db.query(
      `SELECT * FROM crm_lead_lookup_options${where}
       ORDER BY kind ASC, sort_order ASC, id ASC`,
      params,
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => mapLeadLookup(row));
  }

  async createLeadLookup(body: CreateLeadLookupBody): Promise<LeadLookupOption> {
    await this.ensureSeeded();
    const kind = String(body.kind ?? '').trim() as LeadLookupKind;
    if (!LEAD_LOOKUP_KINDS.has(kind)) {
      throw new BadRequestException({ error: 'invalid_lookup_kind' });
    }
    const optionKey = slugKey(String(body.option_key ?? body.label ?? ''));
    if (!optionKey) throw new BadRequestException({ error: 'invalid_option_key' });
    const label = String(body.label ?? optionKey).trim().slice(0, 120);
    const ts = catalogTs();
    try {
      const insert = await this.db.query(
        `INSERT INTO crm_lead_lookup_options
          (kind, option_key, label, sort_order, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $6::timestamptz)
         RETURNING *`,
        [
          kind,
          optionKey,
          label,
          Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 999,
          body.active !== false,
          ts,
        ],
      );
      return mapLeadLookup(insert.rows[0] as Record<string, unknown>);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new BadRequestException({ error: 'duplicate_option_key' });
      }
      throw err;
    }
  }

  async updateLeadLookup(id: number, body: UpdateLeadLookupBody): Promise<LeadLookupOption> {
    await this.ensureSeeded();
    const resolved = await this.resolveLeadLookupPgId(id);
    if (!resolved) throw new NotFoundException({ error: 'lead_lookup_not_found' });

    const existingResult = await this.db.query(
      `SELECT * FROM crm_lead_lookup_options WHERE id = $1`,
      [resolved.pgId],
    );
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) throw new NotFoundException({ error: 'lead_lookup_not_found' });

    const label =
      body.label !== undefined ? String(body.label).trim().slice(0, 120) : String(existing.label);
    const sortOrder =
      body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))
        ? Number(body.sort_order)
        : Number(existing.sort_order ?? 0);
    const active = body.active !== undefined ? body.active : existing.active === true;
    const ts = catalogTs();

    const update = await this.db.query(
      `UPDATE crm_lead_lookup_options
       SET label = $1, sort_order = $2, active = $3, updated_at = $4::timestamptz
       WHERE id = $5
       RETURNING *`,
      [label, sortOrder, active, ts, resolved.pgId],
    );
    return mapLeadLookup(update.rows[0] as Record<string, unknown>);
  }

  async deleteLeadLookup(id: number): Promise<{ ok: true; id: number }> {
    await this.ensureSeeded();
    const resolved = await this.resolveLeadLookupPgId(id);
    if (!resolved) throw new NotFoundException({ error: 'lead_lookup_not_found' });
    const result = await this.db.query(`DELETE FROM crm_lead_lookup_options WHERE id = $1`, [
      resolved.pgId,
    ]);
    if (Number(result.rowCount ?? 0) === 0) {
      throw new NotFoundException({ error: 'lead_lookup_not_found' });
    }
    return { ok: true, id: resolved.legacyId };
  }

  async getCustomField(id: number): Promise<CustomFieldDef> {
    await this.ensureSeeded();
    const resolved = await this.resolveCustomFieldPgId(id);
    if (!resolved) throw new NotFoundException({ error: 'custom_field_not_found' });
    const result = await this.db.query(`SELECT * FROM crm_custom_field_defs WHERE id = $1`, [
      resolved.pgId,
    ]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new NotFoundException({ error: 'custom_field_not_found' });
    return mapCustomField(row);
  }

  async listCustomFields(entityType?: string): Promise<CustomFieldDef[]> {
    await this.ensureSeeded();
    if (entityType) {
      if (!ENTITY_TYPES.has(entityType as CustomFieldEntityType)) {
        throw new BadRequestException({ error: 'invalid_entity_type' });
      }
      const result = await this.db.query(
        `SELECT * FROM crm_custom_field_defs
         WHERE entity_type = $1
         ORDER BY entity_type ASC, sort_order ASC, id ASC`,
        [entityType],
      );
      return (result.rows as Array<Record<string, unknown>>).map((row) => mapCustomField(row));
    }
    const result = await this.db.query(
      `SELECT * FROM crm_custom_field_defs
       ORDER BY entity_type ASC, sort_order ASC, id ASC`,
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => mapCustomField(row));
  }

  async createCustomField(body: CreateCustomFieldBody): Promise<CustomFieldDef> {
    await this.ensureSeeded();
    const entityType = String(body.entity_type ?? '').trim() as CustomFieldEntityType;
    if (!ENTITY_TYPES.has(entityType)) {
      throw new BadRequestException({ error: 'invalid_entity_type' });
    }
    const fieldKey = slugKey(String(body.field_key ?? body.label ?? ''));
    if (!fieldKey) throw new BadRequestException({ error: 'invalid_field_key' });
    const label = String(body.label ?? fieldKey).trim().slice(0, 120);
    const fieldType = (String(body.field_type ?? 'text').trim() as CustomFieldType) || 'text';
    if (!FIELD_TYPES.has(fieldType)) {
      throw new BadRequestException({ error: 'invalid_field_type' });
    }
    const options = Array.isArray(body.options)
      ? body.options.map((v) => String(v).trim()).filter(Boolean).slice(0, 50)
      : [];
    const ts = catalogTs();
    try {
      const insert = await this.db.query(
        `INSERT INTO crm_custom_field_defs
          (entity_type, field_key, label, field_type, options_json, required, sort_order, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::timestamptz, $9::timestamptz)
         RETURNING *`,
        [
          entityType,
          fieldKey,
          label,
          fieldType,
          JSON.stringify(options),
          Boolean(body.required),
          Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
          body.active !== false,
          ts,
        ],
      );
      return mapCustomField(insert.rows[0] as Record<string, unknown>);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new BadRequestException({ error: 'duplicate_field_key' });
      }
      throw err;
    }
  }

  async updateCustomField(id: number, body: UpdateCustomFieldBody): Promise<CustomFieldDef> {
    await this.ensureSeeded();
    const resolved = await this.resolveCustomFieldPgId(id);
    if (!resolved) throw new NotFoundException({ error: 'custom_field_not_found' });

    const existingResult = await this.db.query(`SELECT * FROM crm_custom_field_defs WHERE id = $1`, [
      resolved.pgId,
    ]);
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) throw new NotFoundException({ error: 'custom_field_not_found' });

    const label =
      body.label !== undefined ? String(body.label).trim().slice(0, 120) : String(existing.label);
    const fieldType =
      body.field_type !== undefined
        ? (String(body.field_type).trim() as CustomFieldType)
        : (String(existing.field_type) as CustomFieldType);
    if (!FIELD_TYPES.has(fieldType)) {
      throw new BadRequestException({ error: 'invalid_field_type' });
    }
    const options =
      body.options !== undefined
        ? body.options.map((v) => String(v).trim()).filter(Boolean).slice(0, 50)
        : parseExistingOptions(existing.options_json);
    const required = body.required !== undefined ? Boolean(body.required) : existing.required === true;
    const sortOrder =
      body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))
        ? Number(body.sort_order)
        : Number(existing.sort_order ?? 0);
    const active = body.active !== undefined ? Boolean(body.active) : existing.active === true;
    const ts = catalogTs();

    const update = await this.db.query(
      `UPDATE crm_custom_field_defs
       SET label = $1, field_type = $2, options_json = $3::jsonb, required = $4,
           sort_order = $5, active = $6, updated_at = $7::timestamptz
       WHERE id = $8
       RETURNING *`,
      [label, fieldType, JSON.stringify(options), required, sortOrder, active, ts, resolved.pgId],
    );
    return mapCustomField(update.rows[0] as Record<string, unknown>);
  }

  async deleteCustomField(id: number): Promise<{ ok: true; id: number }> {
    await this.ensureSeeded();
    const resolved = await this.resolveCustomFieldPgId(id);
    if (!resolved) throw new NotFoundException({ error: 'custom_field_not_found' });
    const result = await this.db.query(`DELETE FROM crm_custom_field_defs WHERE id = $1`, [
      resolved.pgId,
    ]);
    if (Number(result.rowCount ?? 0) === 0) {
      throw new NotFoundException({ error: 'custom_field_not_found' });
    }
    return { ok: true, id: resolved.legacyId };
  }

  private fallbackPipelineStages(pipelineKey: string): PipelineStageDef[] {
    const ts = catalogTs();
    return defaultSalesPipelineStages().map((stage, index) => ({
      id: index + 1,
      pipeline_key: pipelineKey,
      updated_at: ts,
      ...stage,
    }));
  }

  async listPipelineStages(
    pipelineKey = DEFAULT_SALES_PIPELINE_KEY,
    includeInactive = false,
  ): Promise<PipelineStageDef[]> {
    await this.ensureSeeded();
    const activeFilter = includeInactive ? '' : ' AND active = TRUE';
    const result = await this.db.query(
      `SELECT * FROM crm_pipeline_stages
       WHERE pipeline_key = $1${activeFilter}
       ORDER BY sort_order ASC, id ASC`,
      [pipelineKey],
    );
    const rows = result.rows as Array<Record<string, unknown>>;
    if (!rows.length) return this.fallbackPipelineStages(pipelineKey);
    return rows.map((row) => mapPipelineStage(row));
  }

  async getPipelineStage(pipelineKey: string, stageKey: string): Promise<PipelineStageDef> {
    await this.ensureSeeded();
    const result = await this.db.query(
      `SELECT * FROM crm_pipeline_stages
       WHERE pipeline_key = $1 AND stage_key = $2`,
      [pipelineKey, stageKey],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new NotFoundException({ error: 'pipeline_stage_not_found' });
    return mapPipelineStage(row);
  }

  async createPipelineStage(
    pipelineKey: string,
    body: CreatePipelineStageBody,
  ): Promise<PipelineStageDef> {
    await this.ensureSeeded();
    const label = String(body.label ?? '').trim();
    if (!label) throw new BadRequestException({ error: 'label_required' });
    const stageKey = slugKey(String(body.stage_key ?? label));
    if (!stageKey) throw new BadRequestException({ error: 'invalid_stage_key' });

    const existing = await this.db.query(
      `SELECT id FROM crm_pipeline_stages WHERE pipeline_key = $1 AND stage_key = $2`,
      [pipelineKey, stageKey],
    );
    if (existing.rows[0]) throw new BadRequestException({ error: 'duplicate_stage_key' });

    const maxSort = await this.db.query(
      `SELECT MAX(sort_order)::int AS n FROM crm_pipeline_stages WHERE pipeline_key = $1`,
      [pipelineKey],
    );
    const sortOrder = Number.isFinite(Number(body.sort_order))
      ? Number(body.sort_order)
      : Number(maxSort.rows[0]?.n ?? -1) + 1;
    const ts = catalogTs();

    await this.db.query(
      `INSERT INTO crm_pipeline_stages
        (pipeline_key, stage_key, label, sort_order, sla_hours, owner_role, is_terminal, active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)`,
      [
        pipelineKey,
        stageKey,
        label.slice(0, 80),
        sortOrder,
        Math.max(0, Number(body.sla_hours ?? 24) || 0),
        String(body.owner_role ?? 'Sales').trim().slice(0, 80),
        Boolean(body.is_terminal),
        body.active !== false,
        ts,
      ],
    );
    return this.getPipelineStage(pipelineKey, stageKey);
  }

  async patchPipelineStage(
    pipelineKey: string,
    stageKey: string,
    body: PatchPipelineStageBody,
  ): Promise<PipelineStageDef> {
    const existing = await this.getPipelineStage(pipelineKey, stageKey);
    const ts = catalogTs();
    const label =
      body.label != null ? String(body.label).trim().slice(0, 80) : existing.label;
    if (!label) throw new BadRequestException({ error: 'label_required' });
    const sortOrder =
      body.sort_order != null && Number.isFinite(Number(body.sort_order))
        ? Number(body.sort_order)
        : existing.sort_order;
    const slaHours =
      body.sla_hours != null ? Math.max(0, Number(body.sla_hours) || 0) : existing.sla_hours;
    const ownerRole =
      body.owner_role != null
        ? String(body.owner_role).trim().slice(0, 80)
        : existing.owner_role;
    const isTerminal = body.is_terminal != null ? Boolean(body.is_terminal) : existing.is_terminal;
    const active = body.active != null ? Boolean(body.active) : existing.active;

    await this.db.query(
      `UPDATE crm_pipeline_stages
       SET label = $1, sort_order = $2, sla_hours = $3, owner_role = $4,
           is_terminal = $5, active = $6, updated_at = $7::timestamptz
       WHERE pipeline_key = $8 AND stage_key = $9`,
      [label, sortOrder, slaHours, ownerRole, isTerminal, active, ts, pipelineKey, stageKey],
    );
    return this.getPipelineStage(pipelineKey, stageKey);
  }

  async deletePipelineStage(
    pipelineKey: string,
    stageKey: string,
  ): Promise<{ ok: true; stage_key: string }> {
    await this.ensureSeeded();
    const result = await this.db.query(
      `DELETE FROM crm_pipeline_stages WHERE pipeline_key = $1 AND stage_key = $2`,
      [pipelineKey, stageKey],
    );
    if (Number(result.rowCount ?? 0) === 0) {
      throw new NotFoundException({ error: 'pipeline_stage_not_found' });
    }
    return { ok: true, stage_key: stageKey };
  }

  async replacePipelineStages(
    pipelineKey: string,
    body: UpdatePipelineStagesBody,
  ): Promise<PipelineStageDef[]> {
    await this.ensureSeeded();
    if (!Array.isArray(body.stages) || !body.stages.length) {
      throw new BadRequestException({ error: 'stages_required' });
    }
    const ts = catalogTs();
    const normalized = body.stages.map((stage, index) => {
      const stageKey = slugKey(String(stage.stage_key ?? stage.label ?? ''));
      if (!stageKey) throw new BadRequestException({ error: 'invalid_stage_key' });
      return {
        stage_key: stageKey,
        label: String(stage.label ?? stageKey).trim().slice(0, 80),
        sort_order: Number.isFinite(Number(stage.sort_order)) ? Number(stage.sort_order) : index,
        sla_hours: Math.max(0, Number(stage.sla_hours ?? 0) || 0),
        owner_role: String(stage.owner_role ?? '').trim().slice(0, 80),
        is_terminal: Boolean(stage.is_terminal),
        active: stage.active !== false,
      };
    });

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM crm_pipeline_stages WHERE pipeline_key = $1`, [pipelineKey]);
      for (const stage of normalized) {
        await client.query(
          `INSERT INTO crm_pipeline_stages
            (pipeline_key, stage_key, label, sort_order, sla_hours, owner_role, is_terminal, active, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)`,
          [
            pipelineKey,
            stage.stage_key,
            stage.label,
            stage.sort_order,
            stage.sla_hours,
            stage.owner_role,
            stage.is_terminal,
            stage.active,
            ts,
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
    return this.listPipelineStages(pipelineKey);
  }

  async getSalesPipelineConfig(): Promise<SalesPipelineConfig> {
    const stages = await this.listPipelineStages(DEFAULT_SALES_PIPELINE_KEY);
    const stageKeys = stages.map((s) => s.stage_key);
    const labels = Object.fromEntries(stages.map((s) => [s.stage_key, s.label]));
    const slaHours = Object.fromEntries(stages.map((s) => [s.stage_key, s.sla_hours]));
    const ownerRoles = Object.fromEntries(stages.map((s) => [s.stage_key, s.owner_role]));
    const terminalStages = new Set(stages.filter((s) => s.is_terminal).map((s) => s.stage_key));

    if (!stageKeys.length) {
      return {
        pipeline_key: DEFAULT_SALES_PIPELINE_KEY,
        stages: this.fallbackPipelineStages(DEFAULT_SALES_PIPELINE_KEY),
        stage_keys: [...SALES_PIPELINE_STAGES],
        labels: { ...SALES_PIPELINE_LABELS_VI },
        sla_hours: { ...STAGE_SLA_HOURS },
        owner_roles: { ...STAGE_OWNER_ROLE },
        terminal_stages: new Set(TERMINAL_STAGES),
      };
    }

    return {
      pipeline_key: DEFAULT_SALES_PIPELINE_KEY,
      stages,
      stage_keys: stageKeys,
      labels,
      sla_hours: slaHours,
      owner_roles: ownerRoles,
      terminal_stages: terminalStages,
    };
  }
}
