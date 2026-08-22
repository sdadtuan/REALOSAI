import type { ThemeQuarterCountRow, ThemeQuarterRow } from './market-research.types';

export function themeQuarterKey(themeCode: string, quarter: number): string {
  return `${themeCode}:${quarter}`;
}

export function deltaPct(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

export function enrichThemeQuarterRows(
  currentRows: ThemeQuarterCountRow[],
  priorYearRows: ThemeQuarterCountRow[],
): ThemeQuarterRow[] {
  const currentByKey = new Map<string, number>();
  const priorYearByKey = new Map<string, number>();

  for (const row of currentRows) {
    currentByKey.set(themeQuarterKey(row.theme_code, row.quarter), row.insight_count);
  }
  for (const row of priorYearRows) {
    priorYearByKey.set(themeQuarterKey(row.theme_code, row.quarter), row.insight_count);
  }

  return currentRows.map((row) => {
    const yoyKey = themeQuarterKey(row.theme_code, row.quarter);
    const hasYoy = priorYearByKey.has(yoyKey);
    const prevYoy = hasYoy ? (priorYearByKey.get(yoyKey) ?? 0) : null;

    let prevQoq: number | null = null;
    if (row.quarter > 1) {
      prevQoq = currentByKey.get(themeQuarterKey(row.theme_code, row.quarter - 1)) ?? 0;
    }

    return {
      ...row,
      prev_qoq_count: prevQoq,
      prev_yoy_count: prevYoy,
      delta_qoq_pct: prevQoq != null ? deltaPct(row.insight_count, prevQoq) : null,
      delta_yoy_pct: prevYoy != null ? deltaPct(row.insight_count, prevYoy) : null,
    };
  });
}
