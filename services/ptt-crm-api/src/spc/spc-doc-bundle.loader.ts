import * as fs from 'node:fs';
import * as path from 'node:path';

export type SpcDocBundleComponent = {
  component_code: string;
  name_vi: string;
  description_vi?: string;
  deliverable_vi?: string;
  price_text_vi?: string;
  pricing_model?: Record<string, unknown>;
  sort_order?: number;
};

export type SpcDocBundleFamily = {
  dv_code: string;
  name_vi?: string;
  service_type?: string;
  components?: SpcDocBundleComponent[];
  bundle_by_tier?: Partial<Record<'CB' | 'TC' | 'CS', string[]>>;
};

export type SpcDocBundleFile = {
  schema_version?: string;
  source_doc?: string;
  families: SpcDocBundleFamily[];
};

function resolveBundlePath(): string {
  const candidates = [
    process.env.SPC_BUNDLE_PATH,
    path.join(process.cwd(), 'docs/specs/spc-chuan-hoa-bundle.json'),
    path.join(process.cwd(), '../../docs/specs/spc-chuan-hoa-bundle.json'),
    path.join(__dirname, '../../../../docs/specs/spc-chuan-hoa-bundle.json'),
  ].filter(Boolean) as string[];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }
  throw new Error('spc_chuan_hoa_bundle_not_found');
}

export function loadSpcDocBundle(): SpcDocBundleFile {
  const filePath = resolveBundlePath();
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as SpcDocBundleFile;
}

export function getDocBundleFamily(dvCode: string): SpcDocBundleFamily | null {
  const bundle = loadSpcDocBundle();
  const code = String(dvCode ?? '').trim().toUpperCase();
  return bundle.families.find((f) => String(f.dv_code).toUpperCase() === code) ?? null;
}

export function listDocBundleFamiliesWithComponents(): SpcDocBundleFamily[] {
  const bundle = loadSpcDocBundle();
  return bundle.families.filter((f) => Array.isArray(f.components) && f.components.length > 0);
}
