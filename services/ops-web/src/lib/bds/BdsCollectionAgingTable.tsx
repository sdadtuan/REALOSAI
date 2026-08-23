'use client';

import Link from 'next/link';
import type { BdsAgingRow } from './types';
import {
  agingBucketLabel,
  buildMilestoneDisplay,
  buildMilestoneStatusLabel,
  summarizeAgingBuckets,
} from './finance-copy';

type Props = {
  rows: BdsAgingRow[];
  onSelectTx?: (txId: string) => void;
};

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n);
}

export function BdsCollectionAgingTable({ rows, onSelectTx }: Props) {
  const buckets = summarizeAgingBuckets(rows);

  return (
    <div className="bds-aging-wrap">
      {buckets.length > 0 ? (
        <div className="bds-aging-buckets" aria-label="Tóm tắt aging">
          {buckets.map((b) => (
            <div key={b.bucket} className={`bds-aging-bucket bds-aging-bucket--${b.bucket}`}>
              <span className="bds-aging-bucket__label">{agingBucketLabel(b.bucket)}</span>
              <strong>{b.count}</strong>
              <span className="muted">{formatVnd(b.remainingVnd)} ₫</span>
            </div>
          ))}
        </div>
      ) : null}

      <table className="table-compact bds-aging-table">
        <thead>
          <tr>
            <th>TX</th>
            <th>Đợt TT</th>
            <th>Mốc XD</th>
            <th>Quá hạn</th>
            <th>Còn lại</th>
            <th>Bucket</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const remaining = Math.max(0, row.amount_vnd - row.paid_vnd);
            const txCell = onSelectTx ? (
              <button type="button" className="link-button" onClick={() => onSelectTx(row.transaction_id)}>
                {row.transaction_id.slice(0, 8)}…
              </button>
            ) : (
              <Link href={`/crm/bds/transactions?tx=${encodeURIComponent(row.transaction_id)}`}>
                {row.transaction_id.slice(0, 8)}…
              </Link>
            );
            return (
              <tr key={row.installment_id}>
                <td>{txCell}</td>
                <td>
                  <span className="bds-aging-code">{row.milestone_code}</span>
                  {row.installment_seq != null ? (
                    <span className="muted"> #{row.installment_seq + 1}</span>
                  ) : null}
                </td>
                <td>
                  {row.build_milestone_code || row.build_milestone_name ? (
                    <div className="bds-aging-milestone">
                      <span>{buildMilestoneDisplay(row.build_milestone_code, row.build_milestone_name)}</span>
                      {row.build_milestone_status ? (
                        <span className="badge badge-sm">
                          {buildMilestoneStatusLabel(row.build_milestone_status)}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>{row.overdue_days} ngày</td>
                <td>{formatVnd(remaining)} ₫</td>
                <td>
                  <span className={`bds-aging-pill bds-aging-pill--${row.bucket}`}>
                    {agingBucketLabel(row.bucket)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
