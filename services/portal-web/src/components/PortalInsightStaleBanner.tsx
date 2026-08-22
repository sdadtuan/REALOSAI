'use client';

import { PORTAL_INSIGHT_STALE_BANNER } from '@/lib/insight-stale.util';

export function PortalInsightStaleBanner({ validTo }: { validTo?: string | null }) {
  const suffix = validTo?.trim() ? ` (đến ${validTo.trim().slice(0, 10)})` : '';
  return (
    <p
      className="muted"
      data-testid="portal-insight-stale-banner"
      style={{
        margin: '0.35rem 0 0',
        padding: '0.45rem 0.55rem',
        borderRadius: 8,
        fontSize: '0.82rem',
        background: 'rgba(180, 83, 9, 0.12)',
        color: '#92400e',
      }}
    >
      {PORTAL_INSIGHT_STALE_BANNER}
      {suffix}
    </p>
  );
}
