import { UPSELL_PATH_CATALOG, serviceLabel } from './upsell.catalog';
import { UpsellContext, UpsellEngineSuggestion } from './upsell.types';

function healthBand(score: number | null): UpsellContext['healthBand'] {
  if (score == null) return null;
  if (score >= 70) return 'healthy';
  if (score >= 55) return 'watch';
  return 'critical';
}

function buildDraftText(
  ctx: UpsellContext,
  sourceLabel: string,
  targetLabel: string,
  reason: string,
): string {
  const client = ctx.clientName ?? 'Quý khách';
  return [
    `Chào ${client},`,
    '',
    `Dựa trên gói ${sourceLabel} đang triển khai, PTT gợi ý mở rộng ${targetLabel}.`,
    reason,
    '',
    'Anh/chị có thể trao đổi thêm scope và báo giá — em sẽ chuẩn bị proposal chi tiết.',
    '',
    '(Draft AI — AM review trước khi gửi, không auto-send.)',
  ].join('\n');
}

/** RNOS-27 — rules v1 upsell cross-sell suggestions. */
export function computeUpsellSuggestions(ctx: UpsellContext, limit = 3): UpsellEngineSuggestion[] {
  if (ctx.healthScore != null && ctx.healthScore < 55) {
    return [];
  }
  if (!ctx.activeServices.length) {
    return [];
  }

  const owned = new Set(ctx.ownedServiceSlugs);
  const channelSet = new Set(ctx.channels.map((c) => c.toLowerCase()));
  const suggestions: UpsellEngineSuggestion[] = [];

  for (const active of ctx.activeServices) {
    const paths = UPSELL_PATH_CATALOG[active.service_slug] ?? [];
    for (const path of paths) {
      if (owned.has(path.target_slug)) continue;

      let confidence = 0.62 + Math.min(path.priority, 10) * 0.015;
      if (ctx.healthScore != null && ctx.healthScore >= 70) confidence += 0.1;
      if (ctx.healthScore != null && ctx.healthScore >= 80) confidence += 0.05;

      if (
        path.target_slug === 'quang-cao-google' &&
        (channelSet.has('meta') || channelSet.has('facebook')) &&
        !channelSet.has('google')
      ) {
        confidence += 0.08;
      }
      if (
        path.target_slug === 'quang-cao-facebook' &&
        channelSet.has('google') &&
        !channelSet.has('meta') &&
        !channelSet.has('facebook')
      ) {
        confidence += 0.08;
      }

      confidence = Math.min(0.92, confidence);
      const sourceLabel = active.service_label || serviceLabel(active.service_slug);
      const targetLabel = path.target_label || serviceLabel(path.target_slug);

      suggestions.push({
        source_service_slug: active.service_slug,
        source_service_label: sourceLabel,
        target_service_slug: path.target_slug,
        target_service_label: targetLabel,
        lifecycle_id: active.lifecycle_id,
        reason: path.reason,
        confidence,
        draft_text: buildDraftText(ctx, sourceLabel, targetLabel, path.reason),
        rule_id: `upsell_v1_${active.service_slug}_to_${path.target_slug}`,
      });
    }
  }

  const deduped = new Map<string, UpsellEngineSuggestion>();
  for (const row of suggestions.sort((a, b) => b.confidence - a.confidence)) {
    const key = `${row.source_service_slug}->${row.target_service_slug}`;
    if (!deduped.has(key)) deduped.set(key, row);
  }

  return [...deduped.values()].slice(0, Math.max(1, limit));
}

export { healthBand };
