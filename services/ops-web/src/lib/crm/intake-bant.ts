export const BANT_KEYS = [
  'budget',
  'authority',
  'need',
  'timeline',
  'fit',
  'history',
] as const;

export type BantKey = (typeof BANT_KEYS)[number];

export const GO_THRESHOLDS = { go: 24, nurture_min: 18 } as const;

export type BantBadge = 'go' | 'nurture' | 'no_go';

export interface BantRowUi {
  key: string;
  label: string;
  hint: string;
}

export const BANT_BADGE_LABELS: Record<BantBadge, string> = {
  go: 'Tiếp tục "Go"',
  nurture: 'Nuôi dưỡng "Nurture"',
  no_go: 'Từ chối "No-Go"',
};

export function computeBantTotal(bant: Record<string, number | undefined>): number {
  let total = 0;
  for (const key of BANT_KEYS) {
    const score = Number(bant[key] ?? 0);
    if (score >= 1 && score <= 5) total += score;
  }
  return total;
}

export function suggestBantBadge(bantTotal: number): BantBadge {
  if (bantTotal >= GO_THRESHOLDS.go) return 'go';
  if (bantTotal >= GO_THRESHOLDS.nurture_min) return 'nurture';
  return 'no_go';
}

export function bantBadgeClass(badge: BantBadge): string {
  if (badge === 'go') return 'intake-bant-badge--go';
  if (badge === 'nurture') return 'intake-bant-badge--nurture';
  return 'intake-bant-badge--no-go';
}

export function getDecisionMismatchMessage(
  decision: string,
  bantTotal: number,
): string | null {
  if (!decision) return null;
  const suggested = suggestBantBadge(bantTotal);
  if (decision === suggested) return null;

  const suggestedLabel = BANT_BADGE_LABELS[suggested];
  const decisionLabels: Record<string, string> = {
    go: BANT_BADGE_LABELS.go,
    nurture: BANT_BADGE_LABELS.nurture,
    no_go: BANT_BADGE_LABELS.no_go,
  };
  const chosen = decisionLabels[decision];
  if (!chosen) return null;

  return `BANT ${bantTotal}/30 gợi ý ${suggestedLabel}, nhưng quyết định đang là ${chosen}. Cân nhắc điều chỉnh hoặc ghi rõ lý do.`;
}

export function bantRowsFromDefinition(
  rows: Array<{ key?: string; label: string; hint: string }> | undefined,
): BantRowUi[] {
  if (!rows?.length) return [];
  const byKey = new Map(rows.map((row) => [row.key ?? row.label.toLowerCase(), row]));
  return BANT_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      label: row?.label ?? key,
      hint: row?.hint ?? '',
    };
  });
}
