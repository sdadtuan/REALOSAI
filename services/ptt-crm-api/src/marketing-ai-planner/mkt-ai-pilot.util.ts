/** P2-13 — pilot DV02/DV04/DV05/DV20 before full “AI toàn hệ” marketing. */
export const MKT_AI_PILOT_DV_CODES = ['DV02', 'DV04', 'DV05', 'DV20'] as const;

/** Default slugs from ops-dv01-dv21-route-map.json pilot DVs. */
export const MKT_AI_PILOT_SERVICE_SLUGS_DEFAULT = [
  'tiep-thi-noi-dung',
  'quang-cao-facebook',
  'quang-cao-google',
  'lead-gen',
  'thue-tai-khoan-quang-cao',
  'dich-vu-seo-tong-the',
  'dich-vu-seo-local',
  'dich-vu-seo-audit',
  'dich-vu-aeo',
  'email-sms-zalo-marketing',
  'meta-lead-gen',
  'bds-lead-gen',
  'seo-retainer',
] as const;

export function parseMktAiPilotServiceSlugs(raw?: string): string[] {
  const fromEnv = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length) return [...new Set(fromEnv)];
  return [...MKT_AI_PILOT_SERVICE_SLUGS_DEFAULT];
}

export function isMktAiPilotServiceSlug(serviceSlug: string, pilotSlugs: readonly string[]): boolean {
  const slug = String(serviceSlug ?? '').trim();
  if (!slug) return false;
  return pilotSlugs.includes(slug);
}

export function buildMktAiPilotContext(
  serviceSlug: string,
  pilotOnlyEnabled: boolean,
  pilotSlugs: readonly string[],
): {
  pilot_only: boolean;
  pilot_dv_codes: readonly string[];
  service_slug_in_pilot: boolean;
  ga_blocked_message_vi: string | null;
} {
  const inPilot = isMktAiPilotServiceSlug(serviceSlug, pilotSlugs);
  return {
    pilot_only: pilotOnlyEnabled,
    pilot_dv_codes: MKT_AI_PILOT_DV_CODES,
    service_slug_in_pilot: inPilot,
    ga_blocked_message_vi: pilotOnlyEnabled && !inPilot
      ? 'AI Marketing đang pilot DV02/DV04/DV05/DV20 — slug ngoài pilot bị khóa (P2-13).'
      : null,
  };
}
