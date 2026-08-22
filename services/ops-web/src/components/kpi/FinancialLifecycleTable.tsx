'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatPct, formatVnd } from '@/lib/kpi/format';

type SortKey = 'margin_pct' | 'lifecycle_id' | 'received_revenue';
type SortDir = 'asc' | 'desc';

export function FinancialLifecycleTable({
  rows,
}: {
  rows: Array<Record<string, unknown>>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('margin_pct');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = Number(a[sortKey] ?? 0);
      const bv = Number(b[sortKey] ?? 0);
      if (!Number.isFinite(av) && !Number.isFinite(bv)) return 0;
      if (!Number.isFinite(av)) return 1;
      if (!Number.isFinite(bv)) return -1;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'margin_pct' ? 'asc' : 'desc');
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  if (!rows.length) {
    return (
      <div className="crm-leads-table-wrap">
        <table className="perf-table financials-lifecycle-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Dịch vụ</th>
              <th>KH</th>
              <th style={{ textAlign: 'right' }}>Doanh thu</th>
              <th style={{ textAlign: 'right' }}>Margin</th>
              <th>Gate</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="muted">
                Chưa có lifecycle active
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="crm-leads-table-wrap">
      <table className="perf-table financials-lifecycle-table">
        <thead>
          <tr>
            <th data-sortable="true" onClick={() => toggleSort('lifecycle_id')}>
              ID{sortIndicator('lifecycle_id')}
            </th>
            <th>Dịch vụ</th>
            <th>KH</th>
            <th data-sortable="true" onClick={() => toggleSort('received_revenue')} style={{ textAlign: 'right' }}>
              Doanh thu{sortIndicator('received_revenue')}
            </th>
            <th data-sortable="true" onClick={() => toggleSort('margin_pct')} style={{ textAlign: 'right' }}>
              Margin{sortIndicator('margin_pct')}
            </th>
            <th>Gate</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const lifecycleId = row.lifecycle_id ?? row.id;
            const marginPct = row.margin_pct != null ? Number(row.margin_pct) : null;
            const arOverdue = Number(row.ar_overdue_vnd ?? 0);
            const paymentBlocked = arOverdue > 0;
            return (
              <tr key={String(lifecycleId ?? i)}>
                <td>
                  {lifecycleId ? (
                    <Link href={`/crm/service-delivery/${lifecycleId}`} className="nav-link">
                      #{String(lifecycleId)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{String(row.service_label ?? row.service_slug ?? '—')}</td>
                <td>{String(row.customer_name ?? '—')}</td>
                <td style={{ textAlign: 'right' }}>{formatVnd(row.received_revenue)}</td>
                <td style={{ textAlign: 'right' }}>
                  {marginPct != null && Number.isFinite(marginPct)
                    ? formatPct(marginPct)
                    : row.margin_vnd != null
                      ? formatVnd(row.margin_vnd)
                      : '—'}
                </td>
                <td>
                  {paymentBlocked ? (
                    <span className="financials-payment-gate financials-payment-gate--blocked" title="AR quá hạn — payment gate">
                      Blocked
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
