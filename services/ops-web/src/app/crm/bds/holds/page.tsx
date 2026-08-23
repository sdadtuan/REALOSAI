'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import {
  fetchProjectHolds,
  postHoldApprove,
  postHoldCancel,
  postHoldReject,
  postUnitHold,
  type BdsHoldRow,
} from '@/lib/bds/api';
import { BdsProjectField } from '@/lib/bds/BdsProjectField';
import { holdActionError, type HoldActionKind } from '@/lib/bds/hold-copy';
import { readBdsProjectId } from '@/lib/bds/project-picker';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';
import { isStaffTicketsFeEnabled } from '@/lib/staff-tickets/flags';

export default function BdsHoldsPage() {
  const searchParams = useSearchParams();
  const holdId = searchParams.get('hold') ?? '';
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_holds', action: 'view' },
  ]);
  const canCreateTicket =
    isStaffTicketsFeEnabled() && hasCap(user, 'staff_tickets', 'create') && holdId.trim().length > 0;
  const canCreate = hasCap(user, 'bds_holds', 'create');
  const canApprove = hasCap(user, 'bds_holds', 'approve');
  const canCancel = hasCap(user, 'bds_holds', 'cancel');

  const [projectId, setProjectId] = useState(() => readBdsProjectId());
  const projectIdRef = useRef(projectId);
  const [rows, setRows] = useState<BdsHoldRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [product_id, setProductId] = useState('');
  const [lead_id, setLeadId] = useState('');
  const [row_version, setRowVersion] = useState('');
  const [channel_partner_id, setChannelPartnerId] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const onProjectChange = (id: number) => {
    projectIdRef.current = id;
    setRows([]);
    setProjectId(id);
  };

  const reload = async (accessToken: string, id: number) => {
    if (id <= 0) {
      if (projectIdRef.current === id) setRows([]);
      return;
    }
    try {
      const data = await fetchProjectHolds(accessToken, id);
      if (projectIdRef.current === id) {
        setRows(data);
        setLoadError('');
      }
    } catch (err) {
      if (projectIdRef.current === id) {
        setLoadError(err instanceof Error ? err.message : 'Tải giữ chỗ thất bại');
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
        const data = await fetchProjectHolds(token, projectId);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Tải giữ chỗ thất bại');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, projectId]);

  const runAction = async (fn: () => Promise<unknown>, kind: HoldActionKind) => {
    if (!token) return;
    setActionError('');
    try {
      await fn();
      await reload(token, projectId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại';
      setActionError(holdActionError(kind, msg));
    }
  };

  const submitHold = () => {
    if (!token) return;
    const productId = Number(product_id);
    const leadId = Number(lead_id);
    const rowVersion = Number(row_version);
    if (!Number.isInteger(productId) || productId <= 0) return;
    if (!Number.isInteger(leadId) || leadId <= 0) return;
    if (!Number.isInteger(rowVersion) || rowVersion < 0) return;
    void runAction(
      () =>
        postUnitHold(
          token,
          productId,
          {
            lead_id: leadId,
            row_version: rowVersion,
            ...(channel_partner_id.trim() ? { channel_partner_id: channel_partner_id.trim() } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          },
          crypto.randomUUID(),
        ),
      'create',
    );
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
      <HubPageLayout title="Hold" subtitle="Giữ chỗ · cọc">
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
                  href={`/crm/work?entity_type=hold&entity_id=${encodeURIComponent(holdId)}`}
                  className="btn btn-sm btn-primary"
                >
                  Tạo ticket
                </Link>
              </div>
            ) : null}
            {!loadError && projectId === 0 ? <p className="muted">Chọn dự án</p> : null}
            {!loadError && projectId > 0 && rows.length === 0 ? (
              <p className="muted">Chưa có giữ chỗ</p>
            ) : null}
            {rows.length > 0 ? (
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>Căn</th>
                    <th>Lead</th>
                    <th>Status</th>
                    <th>TTL</th>
                    <th>Kênh</th>
                    <th>Note</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      style={{ background: row.id === holdId ? '#f5f5f5' : undefined }}
                    >
                      <td>{row.product_id}</td>
                      <td>{row.lead_id}</td>
                      <td>{row.status}</td>
                      <td>{row.expires_at ?? '—'}</td>
                      <td>{row.channel_partner_id || '—'}</td>
                      <td>{row.note || '—'}</td>
                      <td>
                        {row.status === 'pending' && canApprove ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() =>
                                void runAction(
                                  () => postHoldApprove(token ?? '', row.id, user?.email ?? ''),
                                  'approve',
                                )
                              }
                            >
                              Duyệt
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                const reason = window.prompt('Lý do từ chối:');
                                if (!reason?.trim()) return;
                                void runAction(
                                  () => postHoldReject(token ?? '', row.id, reason.trim()),
                                  'reject',
                                );
                              }}
                            >
                              Từ chối
                            </button>
                          </>
                        ) : null}
                        {(row.status === 'active' || row.status === 'pending') && canCancel ? (
                          <>
                            {' '}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                const reason = window.prompt('Lý do hủy:');
                                if (!reason?.trim()) return;
                                void runAction(
                                  () => postHoldCancel(token ?? '', row.id, reason.trim()),
                                  'cancel',
                                );
                              }}
                            >
                              Hủy
                            </button>
                          </>
                        ) : null}
                      </td>
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
                  submitHold();
                }}
              >
                <h3>Giữ chỗ</h3>
                <label>
                  Căn (product_id){' '}
                  <input value={product_id} onChange={(e) => setProductId(e.target.value)} required />
                </label>
                <label>
                  Lead{' '}
                  <input value={lead_id} onChange={(e) => setLeadId(e.target.value)} required />
                </label>
                <label>
                  row_version{' '}
                  <input value={row_version} onChange={(e) => setRowVersion(e.target.value)} required />
                </label>
                <label>
                  Kênh (channel_partner_id){' '}
                  <input
                    value={channel_partner_id}
                    onChange={(e) => setChannelPartnerId(e.target.value)}
                  />
                </label>
                <label>
                  Note{' '}
                  <input value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <button type="submit" className="btn btn-primary btn-sm">
                  Giữ chỗ
                </button>
              </form>
            ) : null}
          </>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
