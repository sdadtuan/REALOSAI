import * as fs from 'fs';
import * as path from 'path';
import { resolveDvByLifecycleSlug } from '../ops/ops-slug-resolver.util';
import type { OpsRouteMap } from '../ops/ops.types';
import {
  normalizeQuoteTier,
  resolveTierPricing,
  type QuotePackageTier,
} from './quote-pricing.util';
import type { QuoteLineInput } from './proposals.types';

export interface DealRoomServiceDvMapping {
  service_slug: string;
  primary_dv: string;
  bundle_dv: string[];
}

export interface DealRoomServiceDvMapFile {
  schema_version: number;
  mappings: DealRoomServiceDvMapping[];
}

export interface ResolvedServiceDvMapping {
  service_slug: string;
  primary_dv: string;
  bundle_dv: string[];
  primary_name: string;
}

export function resolveDealRoomServiceDvMapPath(configPath = ''): string {
  const candidates = [
    configPath,
    path.join(process.cwd(), 'docs/specs/deal-room-service-dv-map.json'),
    path.join(process.cwd(), '../../docs/specs/deal-room-service-dv-map.json'),
    path.join(__dirname, '../../../../docs/specs/deal-room-service-dv-map.json'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`deal_room_service_dv_map_not_found: tried ${candidates.join(', ')}`);
}

export function loadDealRoomServiceDvMap(filePath?: string): DealRoomServiceDvMapFile {
  const resolved = filePath ?? resolveDealRoomServiceDvMapPath();
  const raw = fs.readFileSync(resolved, 'utf8');
  const parsed = JSON.parse(raw) as DealRoomServiceDvMapFile;
  if (!Array.isArray(parsed.mappings)) {
    throw new Error('deal_room_service_dv_map_invalid: missing mappings[]');
  }
  return parsed;
}

export function resolveServiceDvMapping(
  serviceSlug: string,
  routeMap: OpsRouteMap,
  dvMap: DealRoomServiceDvMapFile,
): ResolvedServiceDvMapping {
  const slug = String(serviceSlug ?? '').trim();
  const explicit = dvMap.mappings.find((m) => m.service_slug === slug);
  const dvEntry = resolveDvByLifecycleSlug(slug, routeMap);
  const primaryDv = explicit?.primary_dv ?? dvEntry?.code ?? 'DV04';
  const primaryEntry = routeMap.services.find((s) => s.code === primaryDv);
  const bundle = (explicit?.bundle_dv ?? []).map((code) => code.toUpperCase());
  return {
    service_slug: slug,
    primary_dv: primaryDv,
    bundle_dv: bundle,
    primary_name: primaryEntry?.name_vi ?? primaryDv,
  };
}

export function filterCatalogServicesForSlug(
  routeMap: OpsRouteMap,
  mapping: ResolvedServiceDvMapping,
) {
  const codes = new Set([mapping.primary_dv, ...mapping.bundle_dv]);
  return routeMap.services
    .filter((s) => codes.has(s.code))
    .map((s) => ({
      dv_code: s.code,
      name: s.name_vi,
      service_slug: s.service_slugs.primary,
      readiness: s.readiness,
      depends_on_dv: s.depends_on_dv ?? [],
      is_primary: s.code === mapping.primary_dv,
      is_bundle_suggested: mapping.bundle_dv.includes(s.code),
    }));
}

export function buildAutoQuoteLineInputs(
  mapping: ResolvedServiceDvMapping,
  tierPricing: Record<string, unknown>,
  tierRaw: string,
): QuoteLineInput[] {
  const tier = normalizeQuoteTier(tierRaw) ?? 'standard';
  const reference = resolveTierPricing(tierPricing, tier);
  return [
    {
      dv_code: mapping.primary_dv,
      package_tier: tier,
      final_price_vnd: reference.suggested_vnd,
    },
  ];
}

export function buildDealRoomTierSummaries(
  mapping: ResolvedServiceDvMapping,
  tierPricing: Record<string, unknown>,
  proposalLines: Array<{ package_tier: string; final_price_vnd: number }>,
): Array<{
  tier: QuotePackageTier;
  tier_label: string;
  total_vnd: number;
  reference_min_vnd: number;
  reference_max_vnd: number;
  is_reference: boolean;
}> {
  const tiers: QuotePackageTier[] = ['basic', 'standard', 'premium'];
  const labels: Record<QuotePackageTier, string> = {
    basic: 'Cơ bản',
    standard: 'Tiêu chuẩn',
    premium: 'Chuyên sâu',
  };
  const linesByTier = new Map<string, number>();
  for (const line of proposalLines) {
    const tier = String(line.package_tier ?? 'standard').toLowerCase();
    linesByTier.set(tier, (linesByTier.get(tier) ?? 0) + Number(line.final_price_vnd || 0));
  }
  return tiers.map((tier) => {
    const savedTotal = linesByTier.get(tier);
    if (savedTotal != null && savedTotal > 0) {
      return {
        tier,
        tier_label: labels[tier],
        total_vnd: savedTotal,
        reference_min_vnd: savedTotal,
        reference_max_vnd: savedTotal,
        is_reference: false,
      };
    }
    const ref = resolveTierPricing(tierPricing, tier);
    return {
      tier,
      tier_label: labels[tier],
      total_vnd: ref.suggested_vnd,
      reference_min_vnd: ref.min_vnd,
      reference_max_vnd: ref.max_vnd,
      is_reference: true,
    };
  });
}
