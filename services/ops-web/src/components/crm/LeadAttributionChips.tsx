'use client';

import Link from 'next/link';
import type { LeadAttributionData } from '@/lib/api';

function fmtVnd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('vi-VN')} ₫`;
}

export function LeadAttributionChips({
  attribution,
}: {
  attribution: LeadAttributionData | null | undefined;
}) {
  if (!attribution) {
    return null;
  }

  const hasCampaign = Boolean(attribution.campaign_id);
  const hasCpl = attribution.cpl_vnd != null;

  return (
    <div className="lead-attribution-chips" data-testid="lead-attribution-chips">
      {!hasCampaign && !hasCpl && !attribution.ads_hub_href ? (
        <span className="muted">Chưa có campaign/CPL — map hub để brief/score giải thích tốt hơn.</span>
      ) : null}

      {hasCampaign && attribution.ads_hub_href ? (
        <Link
          href={attribution.ads_hub_href}
          className="lead-attribution-chip lead-attribution-chip--campaign"
          title={`Mở ${attribution.ads_hub_label ?? 'Ads hub'}`}
        >
          Campaign: {attribution.campaign_name ?? attribution.campaign_id}
        </Link>
      ) : hasCampaign ? (
        <span className="lead-attribution-chip lead-attribution-chip--campaign">
          Campaign: {attribution.campaign_name ?? attribution.campaign_id}
        </span>
      ) : null}

      {hasCpl ? (
        <span
          className={`lead-attribution-chip lead-attribution-chip--cpl${
            attribution.cpl_over_target ? ' is-over-target' : ''
          }`}
        >
          CPL {fmtVnd(attribution.cpl_vnd)}
          {attribution.target_cpl_vnd != null ? ` · target ${fmtVnd(attribution.target_cpl_vnd)}` : ''}
          {attribution.cpl_vs_target_pct != null
            ? ` (${attribution.cpl_over_target ? '+' : ''}${attribution.cpl_vs_target_pct}%)`
            : ''}
        </span>
      ) : null}

      {hasCampaign ? (
        <Link href={attribution.hub_href} className="lead-attribution-chip lead-attribution-chip--hub">
          Hub map
        </Link>
      ) : null}

      {!attribution.hub_mapped && hasCampaign ? (
        <span className="lead-attribution-chip lead-attribution-chip--warn">Chưa map hub</span>
      ) : null}
    </div>
  );
}
