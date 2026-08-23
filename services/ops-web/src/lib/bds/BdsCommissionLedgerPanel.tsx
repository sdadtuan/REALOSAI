'use client';

import { useEffect, useState } from 'react';
import { fetchBdsCommissions } from '@/lib/bds/api';
import type { BdsCommissionLedger } from '@/lib/bds/types';

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function BdsCommissionLedgerPanel(props: {
  token: string;
  agencyId: string;
  periodMonth: string;
  reloadToken: number;
  hidePct: boolean;
  onRefresh: () => void;
}) {
  const { token, agencyId, periodMonth, reloadToken, hidePct, onRefresh } = props;
  const [rows, setRows] = useState<BdsCommissionLedger[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!token || !agencyId || !periodMonth) {
      setRows([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchBdsCommissions(token, agencyId, periodMonth);
        if (!cancelled) {
          setRows(data);
          setLoadError('');
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Tải ledger thất bại');
          setRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, agencyId, periodMonth, reloadToken]);

  if (!agencyId) {
    return <p className="muted">Chọn đại lý để xem ledger.</p>;
  }

  return (
    <div>
      <div style={{ marginBottom: '0.75rem' }}>
        <button type="button" className="btn-secondary" onClick={onRefresh}>
          Làm mới
        </button>
      </div>
      {loadError ? <p className="error">{loadError}</p> : null}
      {!loadError && rows.length === 0 ? (
        <p className="muted">Chưa có dòng hoa hồng kỳ này.</p>
      ) : null}
      {rows.length > 0 ? (
        <table className="table-compact">
          <thead>
            <tr>
              <th>ID</th>
              <th>TX</th>
              <th>Mốc</th>
              <th>Trạng thái</th>
              {!hidePct ? <th>%</th> : null}
              <th>Số tiền</th>
              <th>Cơ sở</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isClawback = row.status === 'clawback';
              return (
                <tr key={row.id} style={isClawback ? { opacity: 0.65 } : undefined}>
                  <td>{shortId(row.id)}</td>
                  <td>{row.transaction_id ? shortId(row.transaction_id) : '—'}</td>
                  <td>{row.trigger_stage ?? '—'}</td>
                  <td>{isClawback ? 'Clawback' : (row.status ?? '—')}</td>
                  {!hidePct ? <td>{row.pct ?? '—'}</td> : null}
                  <td>{formatVnd(row.amount_vnd)}</td>
                  <td>{row.base_vnd != null ? formatVnd(row.base_vnd) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
