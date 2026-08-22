'use client';

import type { ForecastMapePriorMonth } from '@/lib/ai-api';

export function ForecastMapeBadge({ mape }: { mape: ForecastMapePriorMonth | null }) {
  if (!mape || mape.mape_pct == null) return null;

  const tone = mape.warn ? 'forecast-mape-badge--warn' : 'forecast-mape-badge--ok';

  return (
    <span
      className={`forecast-mape-badge ${tone}`}
      data-testid="forecast-mape-badge"
      title={`Cam kết ${mape.committed_vnd} vs actual ${mape.actual_vnd}`}
    >
      MAPE {mape.month}: {mape.mape_pct.toFixed(1)}%
      {mape.warn ? ' · >20%' : ''}
    </span>
  );
}
