import { OPS_LEGACY_SLUG_ALIASES } from './ops.constants';
import type { OpsRouteMap, OpsRouteMapService } from './ops.types';

export function buildSlugIndex(map: OpsRouteMap): Map<string, string> {
  const idx = new Map<string, string>();
  for (const svc of map.services) {
    idx.set(svc.service_slugs.primary, svc.code);
    for (const alt of svc.service_slugs.alternates ?? []) {
      if (!idx.has(alt)) idx.set(alt, svc.code);
    }
  }
  for (const [slug, code] of Object.entries(OPS_LEGACY_SLUG_ALIASES)) {
    if (!idx.has(slug)) idx.set(slug, code);
  }
  return idx;
}

export function resolveDvByLifecycleSlug(
  slug: string,
  map: OpsRouteMap,
): OpsRouteMapService | null {
  const normalized = String(slug ?? '').trim();
  if (!normalized) return null;
  const code = buildSlugIndex(map).get(normalized);
  if (!code) return null;
  return map.services.find((s) => s.code === code) ?? null;
}
