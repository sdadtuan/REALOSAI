'use client';

import { PORTAL_CJ_BANNER, formatSharePct } from '@/lib/portal-conjoint.util';
import type { PortalCjSummary } from '@/lib/api';

export function PortalConjointLite({ summary }: { summary: PortalCjSummary }) {
  return (
    <section className="stack-gap" data-testid="portal-conjoint-lite" style={{ marginBottom: '1rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Conjoint lite</h2>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        {PORTAL_CJ_BANNER}
      </p>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        n={summary.n} · {summary.n_choices} lựa chọn
      </p>
      {summary.attributes.map((attr) => (
        <div key={attr.name} style={{ overflowX: 'auto' }}>
          <h3 style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.9rem' }}>{attr.name}</h3>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Mức</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Count</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Share %</th>
              </tr>
            </thead>
            <tbody>
              {attr.levels.map((level) => (
                <tr key={level.label}>
                  <td style={{ padding: '0.4rem' }}>{level.label}</td>
                  <td style={{ padding: '0.4rem' }}>{level.count}</td>
                  <td style={{ padding: '0.4rem' }}>{formatSharePct(level.share_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {summary.recommendation.levels.length ? (
        <div>
          <h3 style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.9rem' }}>Gợi ý gói</h3>
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {summary.recommendation.levels.map((row) => (
              <li key={row.attribute}>
                {row.attribute}: {row.level} ({formatSharePct(row.share_pct)}%)
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {summary.limitation_note ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          {summary.limitation_note}
        </p>
      ) : null}
    </section>
  );
}
