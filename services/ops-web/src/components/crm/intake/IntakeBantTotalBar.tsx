'use client';

import {
  BANT_BADGE_LABELS,
  bantBadgeClass,
  suggestBantBadge,
} from '@/lib/crm/intake-bant';

interface Props {
  total: number;
  max?: number;
}

export function IntakeBantTotalBar({ total, max = 30 }: Props) {
  const badge = suggestBantBadge(total);

  return (
    <div className="intake-bant-total-bar">
      <span className="intake-bant-total-bar__score">
        Tổng BANT <strong>{total}/{max}</strong>
      </span>
      <span className={`intake-bant-badge ${bantBadgeClass(badge)}`}>
        Gợi ý: {BANT_BADGE_LABELS[badge]}
      </span>
    </div>
  );
}
