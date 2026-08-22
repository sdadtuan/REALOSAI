'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  channelFormatLabel,
  fetchContentOsAudit,
  type ContentOsAuditRow,
} from '@/lib/content-os-api';

interface Props {
  token: string;
  lifecycleId: number;
}

export function ContentOsAuditPanel({ token, lifecycleId }: Props) {
  const [rows, setRows] = useState<ContentOsAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchContentOsAudit(token, lifecycleId, 50);
      setRows(res.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải audit thất bại');
    } finally {
      setLoading(false);
    }
  }, [token, lifecycleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
    [rows],
  );

  if (loading) return <p className="muted">Đang tải audit…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '0.9rem' }}>Audit AI + human edits</strong>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => void reload()}>
          Làm mới
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr className="muted" style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '0.4rem' }}>Item</th>
              <th style={{ padding: '0.4rem' }}>Version</th>
              <th style={{ padding: '0.4rem' }}>Reason</th>
              <th style={{ padding: '0.4rem' }}>By</th>
              <th style={{ padding: '0.4rem' }}>AI run</th>
              <th style={{ padding: '0.4rem' }}>When</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr key={`${row.item_id}-${row.version_no}-${idx}`} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.4rem' }}>
                  #{row.item_id} {row.item_title}
                </td>
                <td style={{ padding: '0.4rem' }}>v{row.version_no}</td>
                <td style={{ padding: '0.4rem' }}>{row.change_reason}</td>
                <td style={{ padding: '0.4rem' }}>{row.changed_by}</td>
                <td style={{ padding: '0.4rem' }}>
                  {row.ai_run_id ? (
                    <span title={row.ai_run_id}>{row.ai_run_id.slice(0, 8)}…</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: '0.4rem' }}>
                  {new Date(row.created_at).toLocaleString('vi-VN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!sorted.length ? <p className="muted">Chưa có audit rows — chạy AI generate trước.</p> : null}
    </div>
  );
}
