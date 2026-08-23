import { DEFAULT_SALES_PIPELINE_KEY } from './crm-config.defaults';
import type {
  CustomFieldDef,
  CustomFieldEntityType,
  CustomFieldType,
  LeadLookupKind,
  LeadLookupOption,
  PipelineStageDef,
} from './crm-config.types';

function formatTs(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }
  const s = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return s.replace('T', ' ').slice(0, 19);
  }
  return s;
}

function parseOptions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    if (Array.isArray(parsed)) return parsed.map((v) => String(v));
  } catch {
    /* ignore */
  }
  return [];
}

function asBool(value: unknown, fallback = true): boolean {
  if (value === true || value === false) return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return fallback;
}

export function mapCustomField(row: Record<string, unknown>): CustomFieldDef {
  return {
    id: Number(row.sqlite_field_id ?? row.id),
    entity_type: String(row.entity_type) as CustomFieldEntityType,
    field_key: String(row.field_key),
    label: String(row.label),
    field_type: String(row.field_type) as CustomFieldType,
    options: parseOptions(row.options_json),
    required: asBool(row.required, false),
    sort_order: Number(row.sort_order ?? 0),
    active: asBool(row.active, true),
    created_at: formatTs(row.created_at),
    updated_at: formatTs(row.updated_at),
  };
}

export function mapPipelineStage(row: Record<string, unknown>): PipelineStageDef {
  return {
    id: Number(row.sqlite_stage_id ?? row.id),
    pipeline_key: String(row.pipeline_key ?? DEFAULT_SALES_PIPELINE_KEY),
    stage_key: String(row.stage_key),
    label: String(row.label),
    sort_order: Number(row.sort_order ?? 0),
    sla_hours: Number(row.sla_hours ?? 0),
    owner_role: String(row.owner_role ?? ''),
    is_terminal: asBool(row.is_terminal, false),
    active: asBool(row.active, true),
    updated_at: formatTs(row.updated_at),
  };
}

export function mapLeadLookup(row: Record<string, unknown>): LeadLookupOption {
  return {
    id: Number(row.sqlite_lookup_id ?? row.id),
    kind: String(row.kind) as LeadLookupKind,
    option_key: String(row.option_key),
    label: String(row.label),
    sort_order: Number(row.sort_order ?? 0),
    active: asBool(row.active, true),
    created_at: formatTs(row.created_at),
    updated_at: formatTs(row.updated_at),
  };
}
