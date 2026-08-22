'use client';

import { useEffect, useState } from 'react';
import { fetchMetaBudgetRecommendations } from '@/lib/meta/api';
import type { MetaBudgetRecommendationsResponse } from '@/lib/meta/types';
import { fmtVnd } from '@/lib/meta/format';
import { metaIntelligenceEnabled } from '@/lib/meta/flags';

export function MetaBudgetRecommendCard({
  token,
  clientId,
}: {
  token: string;
  clientId?: string;
}) {
  const [data, setData] = useState<MetaBudgetRecommendationsResponse | null>(null);

  useEffect(() => {
    if (!metaIntelligenceEnabled()) return;
    void fetchMetaBudgetRecommendations(token, clientId ? { client_id: clientId } : undefined)
      .then(setData)
      .catch(() => setData(null));
  }, [token, clientId]);

  const rows = (data?.recommendations ?? []).slice(0, 3);
  if (!rows.length || data?.disabled) {
    return null;
  }

  return (
    <section className="meta-budget-recommend-card card" data-testid="meta-budget-recommend-card">
      <h3 className="kpi-section-title">Budget recommend (read-only) · AI-UC-019</h3>
      <p className="muted">Không auto pause — chỉ gợi ý cho buyer review.</p>
      <ul className="meta-budget-recommend-card__list">
        {rows.map((row) => (
          <li key={`${row.client_id}:${row.external_campaign_id}:${row.recommendation_type}`}>
            <strong>{row.external_campaign_name ?? row.external_campaign_id ?? 'Campaign'}</strong>
            <span className="muted"> · {row.recommendation_type}</span>
            <div>
              TB {fmtVnd(row.current_daily_spend_vnd)} → đề xuất {fmtVnd(row.write_request.daily_budget_vnd)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
