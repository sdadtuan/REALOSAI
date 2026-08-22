'use client';

export type PortalThemeQuarterRow = {
  quarter: number;
  theme_code: string;
  label_vi: string;
  insight_count: number;
  prev_qoq_count?: number | null;
  prev_yoy_count?: number | null;
  delta_qoq_pct?: number | null;
  delta_yoy_pct?: number | null;
};

export type PortalThemeQuarterPivotRow = {
  theme_code: string;
  label_vi: string;
  quarters: [number, number, number, number];
  deltaQoq: [number | null, number | null, number | null, number | null];
  deltaYoy: [number | null, number | null, number | null, number | null];
  total: number;
};

function formatDeltaPct(pct: number): string {
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function QuarterCell({
  count,
  deltaQoq,
  deltaYoy,
}: {
  count: number;
  deltaQoq: number | null;
  deltaYoy: number | null;
}) {
  if (!count) return <>—</>;
  return (
    <>
      {count}
      {deltaQoq != null ? (
        <span className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>
          {formatDeltaPct(deltaQoq)} QoQ
        </span>
      ) : null}
      {deltaYoy != null ? (
        <span className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>
          {formatDeltaPct(deltaYoy)} YoY
        </span>
      ) : null}
    </>
  );
}

export function pivotPortalThemeQuarterRows(rows: PortalThemeQuarterRow[]): PortalThemeQuarterPivotRow[] {
  const byTheme = new Map<string, PortalThemeQuarterPivotRow>();
  for (const row of rows) {
    let entry = byTheme.get(row.theme_code);
    if (!entry) {
      entry = {
        theme_code: row.theme_code,
        label_vi: row.label_vi,
        quarters: [0, 0, 0, 0],
        deltaQoq: [null, null, null, null],
        deltaYoy: [null, null, null, null],
        total: 0,
      };
      byTheme.set(row.theme_code, entry);
    }
    if (row.quarter >= 1 && row.quarter <= 4) {
      const idx = row.quarter - 1;
      entry.quarters[idx] += row.insight_count;
      entry.deltaQoq[idx] = row.delta_qoq_pct ?? null;
      entry.deltaYoy[idx] = row.delta_yoy_pct ?? null;
      entry.total += row.insight_count;
    }
  }
  return [...byTheme.values()].sort(
    (a, b) => b.total - a.total || a.theme_code.localeCompare(b.theme_code),
  );
}

export function PortalThemeQuarterTable({
  rows,
  year,
  selectedThemeCode,
  onThemeClick,
}: {
  rows: PortalThemeQuarterRow[];
  year: number;
  selectedThemeCode?: string;
  onThemeClick?: (themeCode: string) => void;
}) {
  const pivoted = pivotPortalThemeQuarterRows(rows);
  if (pivoted.length === 0) {
    return <p className="muted">Chưa có insight published gắn theme trong năm {year}.</p>;
  }

  return (
    <table className="data-table" style={{ width: '100%' }}>
      <thead>
        <tr>
          <th>Theme</th>
          <th>Q1</th>
          <th>Q2</th>
          <th>Q3</th>
          <th>Q4</th>
          <th>Tổng</th>
        </tr>
      </thead>
      <tbody>
        {pivoted.map((row) => {
          const active = selectedThemeCode === row.theme_code;
          return (
            <tr key={row.theme_code}>
              <td>
                {onThemeClick ? (
                  <button
                    type="button"
                    className={active ? 'btn btn-sm' : 'btn btn-sm btn-secondary'}
                    onClick={() => onThemeClick(row.theme_code)}
                  >
                    {row.label_vi}
                    <span className="muted" style={{ marginLeft: '0.35rem', fontSize: '0.8rem' }}>
                      ({row.theme_code})
                    </span>
                  </button>
                ) : (
                  <>
                    {row.label_vi}
                    <span className="muted" style={{ marginLeft: '0.35rem', fontSize: '0.8rem' }}>
                      ({row.theme_code})
                    </span>
                  </>
                )}
              </td>
              {row.quarters.map((count, idx) => (
                <td key={idx}>
                  <QuarterCell
                    count={count}
                    deltaQoq={row.deltaQoq[idx]}
                    deltaYoy={row.deltaYoy[idx]}
                  />
                </td>
              ))}
              <td>{row.total}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
