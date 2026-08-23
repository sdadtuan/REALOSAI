'use client';

import { useEffect, useRef, useState } from 'react';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import {
  downloadCollectionExport,
  fetchCollectionAging,
  postReceipt,
  type BdsAgingRow,
} from '@/lib/bds/api';
import { BdsProjectField } from '@/lib/bds/BdsProjectField';
import { readBdsProjectId } from '@/lib/bds/project-picker';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

const METHODS = ['bank', 'cash', 'loan'] as const;

function collectionError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : fallback;
  return msg.includes('404') ? 'Công nợ chưa bật' : msg;
}

export default function BdsCollectionsPage() {
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_collections', action: 'view' },
  ]);
  const canCreate = hasCap(user, 'bds_collections', 'create');
  const canExport = hasCap(user, 'bds_collections', 'export');

  const [projectId, setProjectId] = useState(() => readBdsProjectId());
  const projectIdRef = useRef(projectId);
  const [rows, setRows] = useState<BdsAgingRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [transaction_id, setTransactionId] = useState('');
  const [amount_vnd, setAmountVnd] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('bank');
  const [paid_at, setPaidAt] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const onProjectChange = (id: number) => {
    projectIdRef.current = id;
    setRows([]);
    setLoadError('');
    setActionError('');
    setProjectId(id);
  };

  const reload = async (accessToken: string, id: number) => {
    if (id <= 0) {
      if (projectIdRef.current === id) setRows([]);
      return;
    }
    try {
      const data = await fetchCollectionAging(accessToken, id);
      if (projectIdRef.current === id) {
        setRows(data);
        setLoadError('');
      }
    } catch (err) {
      if (projectIdRef.current === id) {
        setLoadError(collectionError(err, 'Tải aging thất bại'));
      }
    }
  };

  useEffect(() => {
    setRows([]);
    if (!token || projectId === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        setLoadError('');
        const data = await fetchCollectionAging(token, projectId);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(collectionError(err, 'Tải aging thất bại'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, projectId]);

  const runAction = async (fn: () => Promise<unknown>) => {
    if (!token) return;
    const actionProjectId = projectIdRef.current;
    setActionError('');
    try {
      await fn();
      if (projectIdRef.current === actionProjectId) {
        await reload(token, actionProjectId);
      }
    } catch (err) {
      if (projectIdRef.current === actionProjectId) {
        setActionError(collectionError(err, 'Thao tác thất bại'));
      }
    }
  };

  const submitReceipt = () => {
    if (!token) return;
    const tx = transaction_id.trim();
    const amount = Number(amount_vnd);
    if (!tx || !Number.isFinite(amount) || amount <= 0) return;
    const paid = paid_at.trim();
    const memo = note.trim();
    void runAction(() =>
      postReceipt(token, {
        transaction_id: tx,
        amount_vnd: amount,
        method,
        ...(paid ? { paid_at: paid } : {}),
        ...(memo ? { note: memo } : {}),
      }),
    );
  };

  const exportCsv = () => {
    if (!token || projectId === 0) return;
    void runAction(() => downloadCollectionExport(token, projectId));
  };

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Công nợ" subtitle="Sổ thu căn — không phải hạch toán.">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="muted">{loadError}</p> : null}
        {actionError ? <p className="muted">{actionError}</p> : null}
        {!loading && !error ? (
          <>
            {token ? (
              <BdsProjectField token={token} value={projectId} onChange={onProjectChange} />
            ) : null}
            {canExport && token ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={exportCsv}
                  disabled={projectId === 0}
                >
                  Xuất CSV
                </button>
              </div>
            ) : null}
            {!loadError && projectId === 0 ? <p className="muted">Chọn dự án</p> : null}
            {!loadError && projectId > 0 && rows.length === 0 ? (
              <p className="muted">Chưa có công nợ</p>
            ) : null}
            {rows.length > 0 ? (
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>TX</th>
                    <th>Đợt</th>
                    <th>Quá hạn</th>
                    <th>Còn</th>
                    <th>Bucket</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.installment_id}>
                      <td>{row.transaction_id}</td>
                      <td>{row.milestone_code}</td>
                      <td>{row.overdue_days}</td>
                      <td>{(row.amount_vnd - row.paid_vnd).toLocaleString('vi-VN')}</td>
                      <td>{row.bucket}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {canCreate && token ? (
              <form
                style={{ marginTop: '1.5rem', display: 'grid', gap: '0.5rem', maxWidth: '24rem' }}
                onSubmit={(e) => {
                  e.preventDefault();
                  submitReceipt();
                }}
              >
                <h3>Ghi phiếu thu</h3>
                <label>
                  TX{' '}
                  <input
                    value={transaction_id}
                    onChange={(e) => setTransactionId(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Số tiền (VND){' '}
                  <input
                    value={amount_vnd}
                    onChange={(e) => setAmountVnd(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Method{' '}
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
                  >
                    {METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ngày{' '}
                  <input
                    type="date"
                    value={paid_at}
                    onChange={(e) => setPaidAt(e.target.value)}
                  />
                </label>
                <label>
                  Note{' '}
                  <input value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <button type="submit" className="btn btn-primary btn-sm">
                  Ghi phiếu thu
                </button>
              </form>
            ) : null}
          </>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
