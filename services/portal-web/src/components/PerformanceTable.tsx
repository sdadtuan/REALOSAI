import type { PerformanceRow } from '@/lib/api';
import { fmtDate, fmtDeltaPct, fmtDeltaVnd, fmtNumber, fmtVnd } from '@/lib/format';

interface PerformanceTableProps {
  rows: PerformanceRow[];
  groupBy: 'day' | 'campaign';
  hideChannel?: boolean;
}

function isOverTarget(row: PerformanceRow): boolean {
  return row.cpl != null && row.target_cpl_vnd != null && row.cpl > row.target_cpl_vnd;
}

function channelLabel(channel: string | null | undefined): string {
  if (channel === 'google') return 'Google';
  if (channel === 'zalo') return 'Zalo';
  return 'Meta';
}

function rowKey(row: PerformanceRow, idx: number): string {
  return `${row.performance_date ?? 'agg'}-${row.external_campaign_id ?? idx}`;
}

function PerformanceRowCard({
  row,
  groupBy,
  hideChannel,
}: {
  row: PerformanceRow;
  groupBy: 'day' | 'campaign';
  hideChannel?: boolean;
}) {
  const overTarget = isOverTarget(row);
  const deltaOver = row.cpl_delta_vnd != null && row.cpl_delta_vnd > 0;

  return (
    <article className={`perf-mobile-card${overTarget ? ' perf-mobile-card--alert' : ''}`}>
      <div className="perf-mobile-card__head">
        <div>
          {groupBy === 'day' ? <p className="perf-mobile-card__date">{fmtDate(row.performance_date)}</p> : null}
          {!hideChannel ? <span className="channel-badge">{channelLabel(row.channel)}</span> : null}
          <h4 className="perf-mobile-card__title">{row.external_campaign_name ?? row.external_campaign_id ?? '—'}</h4>
          {row.external_campaign_id ? (
            <p className="muted perf-mobile-card__id">{row.external_campaign_id}</p>
          ) : null}
        </div>
        {row.hub_mapped ? (
          <span className="map-badge map-badge--ok">Mapped</span>
        ) : (
          <span className="map-badge map-badge--warn">Chưa map</span>
        )}
      </div>
      <dl className="perf-mobile-card__metrics">
        <div>
          <dt>Spend</dt>
          <dd>{fmtVnd(row.spend)}</dd>
        </div>
        <div>
          <dt>Leads CRM</dt>
          <dd>{fmtNumber(row.leads_crm)}</dd>
        </div>
        <div>
          <dt>CPL</dt>
          <dd className={overTarget ? 'over-target' : undefined}>{fmtVnd(row.cpl)}</dd>
        </div>
        <div>
          <dt>Target CPL</dt>
          <dd>{fmtVnd(row.target_cpl_vnd)}</dd>
        </div>
        <div>
          <dt>CPL Δ</dt>
          <dd className={deltaOver || overTarget ? 'over-target' : undefined}>
            {row.cpl_delta_vnd != null ? (
              <>
                {fmtDeltaVnd(row.cpl_delta_vnd)}
                {row.cpl_delta_pct != null ? ` (${fmtDeltaPct(row.cpl_delta_pct)})` : ''}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt>ROAS</dt>
          <dd>{row.roas_stub ? '—' : (row.roas?.toFixed(2) ?? '—')}</dd>
        </div>
      </dl>
    </article>
  );
}

export function PerformanceTable({ rows, groupBy, hideChannel = false }: PerformanceTableProps) {
  if (rows.length === 0) {
    return <p className="muted">Không có dữ liệu performance trong khoảng thời gian đã chọn.</p>;
  }

  return (
    <>
      <div className="perf-table-wrap perf-table-wrap--desktop">
        <table className="perf-table">
          <thead>
            <tr>
              {groupBy === 'day' && <th>Ngày</th>}
              {!hideChannel && <th>Kênh</th>}
              <th>Chiến dịch</th>
              <th>Map</th>
              <th className="num">Spend</th>
              <th className="num">Leads CRM</th>
              <th className="num">CPL</th>
              <th className="num">Target CPL</th>
              <th className="num">CPL Δ</th>
              <th className="num">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const overTarget = isOverTarget(row);
              const deltaOver = row.cpl_delta_vnd != null && row.cpl_delta_vnd > 0;
              return (
                <tr key={rowKey(row, idx)}>
                  {groupBy === 'day' && <td>{fmtDate(row.performance_date)}</td>}
                  {!hideChannel && (
                    <td>
                      <span className="channel-badge">{channelLabel(row.channel)}</span>
                    </td>
                  )}
                  <td>
                    <div>{row.external_campaign_name ?? row.external_campaign_id ?? '—'}</div>
                    {row.external_campaign_id ? (
                      <div className="muted perf-table__campaign-id">{row.external_campaign_id}</div>
                    ) : null}
                  </td>
                  <td>
                    {row.hub_mapped ? (
                      <span className="map-badge map-badge--ok" title="Đã map Hub campaign">
                        Mapped
                      </span>
                    ) : (
                      <span className="map-badge map-badge--warn" title="Chưa map Hub — CPL có thể thiếu chính xác">
                        Chưa map
                      </span>
                    )}
                  </td>
                  <td className="num">{fmtVnd(row.spend)}</td>
                  <td className="num">{fmtNumber(row.leads_crm)}</td>
                  <td className={`num${overTarget ? ' over-target' : ''}`}>{fmtVnd(row.cpl)}</td>
                  <td className="num">{fmtVnd(row.target_cpl_vnd)}</td>
                  <td className={`num${deltaOver || overTarget ? ' over-target' : ''}`}>
                    {row.cpl_delta_vnd != null ? (
                      <>
                        {fmtDeltaVnd(row.cpl_delta_vnd)}
                        {row.cpl_delta_pct != null ? (
                          <span className="muted perf-table__delta-pct">({fmtDeltaPct(row.cpl_delta_pct)})</span>
                        ) : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="num">
                    {row.roas_stub ? (
                      <span className="muted" title="Chưa có conversion value">
                        —
                      </span>
                    ) : (
                      (row.roas?.toFixed(2) ?? '—')
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="perf-mobile-list">
        {rows.map((row, idx) => (
          <PerformanceRowCard key={rowKey(row, idx)} row={row} groupBy={groupBy} hideChannel={hideChannel} />
        ))}
      </div>
    </>
  );
}
