import * as fs from 'fs';
import * as path from 'path';

export type FieldMaskMode = 'hidden' | 'partial' | 'strip';

export interface FieldRegistryEntry {
  entity: string;
  field: string;
  section: string;
  action: string;
  mask_mode: FieldMaskMode;
  mask_value?: string;
  patch_forbidden?: boolean;
  export_strip?: boolean;
}

export interface FieldRegistryDocument {
  version: number;
  fields: FieldRegistryEntry[];
}

const REGISTRY_CANDIDATES = [
  path.resolve(process.cwd(), 'config', 'rbac_field_registry.json'),
  path.resolve(__dirname, '..', '..', 'config', 'rbac_field_registry.json'),
];

let cached: FieldRegistryDocument | null = null;

export function loadFieldRegistry(): FieldRegistryDocument {
  if (cached) return cached;
  const filePath = REGISTRY_CANDIDATES.find((p) => fs.existsSync(p));
  if (!filePath) {
    cached = { version: 1, fields: [] };
    return cached;
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as FieldRegistryDocument;
  cached = {
    version: Number(raw.version ?? 1),
    fields: Array.isArray(raw.fields) ? raw.fields : [],
  };
  return cached;
}

export function listFieldRegistryEntries(): FieldRegistryEntry[] {
  return loadFieldRegistry().fields;
}

export function fieldRegistryEntriesForEntity(entity: string): FieldRegistryEntry[] {
  const normalized = entity.trim().toLowerCase();
  return loadFieldRegistry().fields.filter((e) => e.entity.trim().toLowerCase() === normalized);
}

/** Test helper */
export function resetFieldRegistryCache(): void {
  cached = null;
}
