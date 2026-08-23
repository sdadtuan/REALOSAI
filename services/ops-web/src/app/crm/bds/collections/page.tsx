'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import {
  downloadCollectionExport,
  fetchCollectionAging,
  fetchProjectMilestones,
  postReceipt,
  type BdsAgingRow,
} from '@/lib/bds/api';
import { BdsBuildMilestonesPanel } from '@/lib/bds/BdsBuildMilestonesPanel';
import { BdsCollectionAgingTable } from '@/lib/bds/BdsCollectionAgingTable';
import { BdsProjectField } from '@/lib/bds/BdsProjectField';
import { collectionsPageDisclaimer, financeHubDisclaimer } from '@/lib/bds/finance-copy';
import { readBdsProjectId } from '@/lib/bds/project-picker';
import type { BdsMilestone } from '@/lib/bds/types';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

const METHODS = ['bank', 'cash', 'loan'] as const;

function collectionError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : fallback;
  return msg.includes('404') ? 'Công nợ chưa bật' : msg;
}

export default function BdsCollectionsPage() {
  const searchParams = useSearchParams();
  const txFromQuery = searchParams.get('tx') ?? '';

  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_collections', action: 'view' },
  ]);
  const canCreate = hasCap(user, 'bds_collections', 'create');
  const canExport = hasCap(user, 'bds_collections', 'export');

  const [projectId, setProjectId] = useState(() => readBdsProjectId());
  const projectIdRef = useRef(projectId);
  const [rows, setRows] = useState<BdsAgingRow[]>([]);
  const [milestones, setMilestones] = useState<BdsMilestone[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [transaction_id, setTransactionId] = useState('');
  const [amount_vnd, setAmountVnd] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('bank');
  const [paid_at, setPaidAt] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (txFromQuery.trim()) setTransactionId(txFromQuery.trim());
  }, [txFromQuery]);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const onProjectChange = (id: number) => {
    projectIdRef.current = id;
    setRows([]);
    setMilestones([]);
    setLoadError('');
    setActionError('');
    setProjectId(id);
  };

  const reload = async (accessToken: string, id: number) => {
    if (id <= 0) {
      if (projectIdRef.current === id) {
        setRows([]);
        setMilestones([]);
      }
      return;
    }
    try {
      const [aging, ms] = await Promise.all([
        fetchCollectionAging(accessToken, id),
        fetchProjectMilestones(accessToken, id),
      ]);
      if (projectIdRef.current === id) {
        setRows(aging);
        setMilestones(ms);
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
    setMilestones([]);
    if (!token || projectId === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        setLoadError('');
        const [aging, ms] = await Promise.all([
          fetchCollectionAging(token, projectId),
          fetchProjectMilestones(token, projectId),
        ]);
        if (!cancelled) {
          setRows(aging);
          setMilestones(ms);
        }
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
      <HubPageLayout title="Công nợ" subtitle={collectionsPageDisclaimer()}>
        {token ? (
          <p className="muted">
            {financeHubDisclaimer()} Chi tiết 4 số tháng ở{' '}
            <Link href="/crm/bds#finance">Tổng quan</Link>.
          </p>
        ) : null}
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="muted">{loadError}</p> : null}
        {actionError ? <p className="error">{actionError}</p> : null}
        {!loading && !error ? (
          <>
            {token ? (
              <BdsProjectField token={token} value={projectId} onChange={onProjectChange} />
            ) : null}
            {canExport && token ? (
              <div className="bds-collections-toolbar">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={exportCsv}
                  disabled={projectId === 0}
                >
                  Xuất CSV
                </button>
                <Link href="/crm/work?queue=collection_schedule" className="btn btn-secondary btn-sm">
                  Việc collection_schedule
                </Link>
              </div>
            ) : null}
            {!loadError && projectId === 0 ? <p className="muted">Chọn dự án</p> : null}
            {!loadError && projectId > 0 ? (
              <BdsBuildMilestonesPanel milestones={milestones} />
            ) : null}
            {!loadError && projectId > 0 && rows.length === 0 ? (
              <p className="muted">Chưa có công nợ quá hạn</p>
            ) : null}
            {rows.length > 0 ? (
              <BdsCollectionAgingTable
                rows={rows}
                onSelectTx={canCreate ? (tx) => setTransactionId(tx) : undefined}
              />
            ) : null}
            {canCreate && token ? (
              <form
                className="bds-receipt-form"
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
                  <input type="date" value={paid_at} onChange={(e) => setPaidAt(e.target.value)} />
                </label>
                <label>
                  Note <input value={note} onChange={(e) => setNote(e.target.value)} />
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
