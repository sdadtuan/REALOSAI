'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import {
  fetchHdmbGate,
  fetchProjectTransactions,
  postConvertDeposit,
  postTxContract,
  postTxVbtt,
  type BdsHdmbGate,
  type BdsTxRow,
} from '@/lib/bds/api';
import { BdsProjectField } from '@/lib/bds/BdsProjectField';
import { readBdsProjectId } from '@/lib/bds/project-picker';
import { parseContractSubmit, txGateCopy } from '@/lib/bds/tx-copy';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';
import { isStaffTicketsFeEnabled } from '@/lib/staff-tickets/flags';

export default function BdsTransactionsPage() {
  const searchParams = useSearchParams();
  const txId = searchParams.get('tx') ?? '';
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_transactions', action: 'view' },
  ]);
  const canCreateTicket =
    isStaffTicketsFeEnabled() && hasCap(user, 'staff_tickets', 'create') && txId.trim().length > 0;
  const canCreate = hasCap(user, 'bds_transactions', 'create');
  const canEdit = hasCap(user, 'bds_transactions', 'edit');

  const [projectId, setProjectId] = useState(() => readBdsProjectId());
  const projectIdRef = useRef(projectId);
  const [rows, setRows] = useState<BdsTxRow[]>([]);
  const [selectedId, setSelectedId] = useState(txId);
  const [gate, setGate] = useState<BdsHdmbGate | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [hold_id, setHoldId] = useState('');
  const [deposit_vnd, setDepositVnd] = useState('');
  const [policy_id, setPolicyId] = useState('');
  const [row_version, setRowVersion] = useState('');
  const [vbtt_no, setVbttNo] = useState('');
  const [contract_no, setContractNo] = useState('');
  const [contract_row_version, setContractRowVersion] = useState('');

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const onProjectChange = (id: number) => {
    projectIdRef.current = id;
    setRows([]);
    setSelectedId('');
    setGate(null);
    setGateLoading(false);
    setProjectId(id);
  };

  const reload = async (accessToken: string, id: number) => {
    if (id <= 0) {
      if (projectIdRef.current === id) setRows([]);
      return;
    }
    try {
      const data = await fetchProjectTransactions(accessToken, id);
      if (projectIdRef.current === id) {
        setRows(data);
        setLoadError('');
      }
    } catch (err) {
      if (projectIdRef.current === id) {
        setLoadError(err instanceof Error ? err.message : 'Tải giao dịch thất bại');
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
        const data = await fetchProjectTransactions(token, projectId);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Tải giao dịch thất bại');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, projectId]);

  useEffect(() => {
    if (!token || !selectedId) {
      setGate(null);
      setGateLoading(false);
      return;
    }
    let cancelled = false;
    setGateLoading(true);
    void (async () => {
      try {
        const data = await fetchHdmbGate(token, selectedId);
        if (!cancelled) {
          setGate(data);
          setGateLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setGate(null);
          setGateLoading(false);
          setActionError(txGateCopy(err instanceof Error ? err.message : 'Tải cổng thất bại'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selectedId]);

  const runAction = async (fn: () => Promise<unknown>) => {
    if (!token) return;
    setActionError('');
    try {
      await fn();
      await reload(token, projectId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại';
      setActionError(txGateCopy(msg));
    }
  };

  const submitDeposit = () => {
    if (!token) return;
    const holdId = hold_id.trim();
    const depositVnd = Number(deposit_vnd);
    const policyId = policy_id.trim();
    const rowVersion = Number(row_version);
    if (!holdId) return;
    if (!Number.isFinite(depositVnd) || depositVnd <= 0) return;
    if (!policyId) return;
    if (!Number.isInteger(rowVersion) || rowVersion < 0) return;
    void runAction(() =>
      postConvertDeposit(
        token,
        holdId,
        { deposit_vnd: depositVnd, policy_id: policyId, row_version: rowVersion },
        crypto.randomUUID(),
      ),
    );
  };

  const submitVbtt = () => {
    if (!token || !selectedId || !vbtt_no.trim()) return;
    void runAction(() => postTxVbtt(token, selectedId, vbtt_no.trim()));
  };

  const submitContract = () => {
    if (!token || !selectedId) return;
    const body = parseContractSubmit(contract_no, contract_row_version);
    if (!body) return;
    void runAction(() => postTxContract(token, selectedId, body));
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
      <HubPageLayout title="Giao dịch" subtitle="VBTT · HĐMB">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="muted">{loadError}</p> : null}
        {actionError ? <p className="muted">{actionError}</p> : null}
        {!loading && !error ? (
          <>
            {token ? (
              <BdsProjectField token={token} value={projectId} onChange={onProjectChange} />
            ) : null}
            {canCreateTicket ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
                <Link
                  href={`/crm/work?entity_type=tx&entity_id=${encodeURIComponent(txId)}`}
                  className="btn btn-sm btn-primary"
                >
                  Tạo ticket
                </Link>
              </div>
            ) : null}
            {!loadError && projectId === 0 ? <p className="muted">Chọn dự án</p> : null}
            {!loadError && projectId > 0 && rows.length === 0 ? (
              <p className="muted">Chưa có giao dịch</p>
            ) : null}
            {rows.length > 0 ? (
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>Căn</th>
                    <th>Stage</th>
                    <th>Thu %</th>
                    <th>Giá net</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      style={{
                        cursor: 'pointer',
                        background: row.id === selectedId || row.id === txId ? '#f5f5f5' : undefined,
                      }}
                    >
                      <td>{row.product_id}</td>
                      <td>{row.stage}</td>
                      <td>{row.paid_pct}</td>
                      <td>{row.net_price_vnd.toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {selectedId ? (
              <section style={{ marginTop: '1.5rem' }}>
                <h3>Cổng HĐMB</h3>
                {gate ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '32rem' }}>
                    <div>
                      <strong>Pháp lý</strong>
                      <p className="muted">{gate.legal.ready ? 'Sẵn sàng' : 'Chưa'}</p>
                    </div>
                    <div>
                      <strong>Thu %</strong>
                      <p className="muted">
                        {gate.paid_pct} / {gate.hdmb_min_paid_pct}
                      </p>
                    </div>
                  </div>
                ) : gateLoading ? (
                  <p className="muted">Đang tải cổng…</p>
                ) : null}
                {canEdit ? (
                  <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem', maxWidth: '24rem' }}>
                    <label>
                      Số VBTT{' '}
                      <input value={vbtt_no} onChange={(e) => setVbttNo(e.target.value)} />
                    </label>
                    <button type="button" className="btn btn-primary btn-sm" onClick={submitVbtt}>
                      Ghi VBTT
                    </button>
                    <form
                      style={{ display: 'grid', gap: '0.75rem' }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        submitContract();
                      }}
                    >
                      <label>
                        Số HĐMB{' '}
                        <input
                          value={contract_no}
                          onChange={(e) => setContractNo(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Phiên bản căn (row_version){' '}
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={contract_row_version}
                          onChange={(e) => setContractRowVersion(e.target.value)}
                          required
                        />
                      </label>
                      <button type="submit" className="btn btn-primary btn-sm">
                        Ký HĐMB
                      </button>
                    </form>
                  </div>
                ) : null}
              </section>
            ) : null}
            {canCreate && token ? (
              <form
                style={{ marginTop: '1.5rem', display: 'grid', gap: '0.5rem', maxWidth: '24rem' }}
                onSubmit={(e) => {
                  e.preventDefault();
                  submitDeposit();
                }}
              >
                <h3>Cọc</h3>
                <label>
                  Hold{' '}
                  <input value={hold_id} onChange={(e) => setHoldId(e.target.value)} required />
                </label>
                <label>
                  Tiền cọc (VND){' '}
                  <input value={deposit_vnd} onChange={(e) => setDepositVnd(e.target.value)} required />
                </label>
                <label>
                  Policy{' '}
                  <input value={policy_id} onChange={(e) => setPolicyId(e.target.value)} required />
                </label>
                <label>
                  row_version{' '}
                  <input value={row_version} onChange={(e) => setRowVersion(e.target.value)} required />
                </label>
                <button type="submit" className="btn btn-primary btn-sm">
                  Cọc
                </button>
              </form>
            ) : null}
          </>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
