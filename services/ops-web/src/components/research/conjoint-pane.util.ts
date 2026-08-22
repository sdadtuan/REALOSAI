export const CJ_TAB_BANNER =
  'Conjoint lite — đếm mức được chọn theo thuộc tính. Không market simulator. Không suy MOE.';

export const CJ_WHATIF_BANNER =
  'What-if lite — đếm lựa chọn trong mẫu khớp gói giả định. Không market share. Không suy diễn thống kê.';

export const CJ_WHATIF_PERSIST_BANNER =
  'Lưu scenario staff — không tạo insight; không hiển thị trên portal.';

export function formatScenarioSummary(scenario: Record<string, string>): string {
  const entries = Object.entries(scenario ?? {}).filter(
    ([key, value]) => key.trim() && String(value ?? '').trim(),
  );
  if (!entries.length) return '—';
  return entries.map(([key, value]) => `${key}: ${value}`).join(' · ');
}

export function defaultWhatIfScenario(
  attributes: Array<{ name: string; levels: Array<{ label: string }>; top_level?: string | null }>,
  recommendation?: { levels: Array<{ attribute: string; level: string }> },
): Record<string, string> {
  const rec = new Map((recommendation?.levels ?? []).map((row) => [row.attribute, row.level]));
  const out: Record<string, string> = {};
  for (const attr of attributes) {
    const picked = rec.get(attr.name) ?? attr.top_level ?? attr.levels[0]?.label;
    if (picked) out[attr.name] = picked;
  }
  return out;
}

export function formatWhatIfResult(nMatch: number, nChoices: number, matchPct: number): string {
  return `Khớp mẫu: ${nMatch} / ${nChoices} (${formatSharePct(matchPct)}%)`;
}

export function shouldShowConjointTab(productType: string): boolean {
  return productType === 'PRICE_OFFER';
}

export function formatSharePct(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
