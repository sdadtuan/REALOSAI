'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import {
  fetchBdsLeads,
  postLeadQualify,
  postLeadTouch,
  postLeadVisit,
  type BdsBuyerRow,
} from '@/lib/bds/api';
import { BdsProjectField } from '@/lib/bds/BdsProjectField';
import { readBdsProjectId } from '@/lib/bds/project-picker';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';
import { isStaffTicketsFeEnabled } from '@/lib/staff-tickets/flags';

const QUALIFY_STATUSES = ['moi', 'da_lien_he', 'xem_nha', 'giu_cho', 'lost'] as const;

export default function BdsLeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get('lead') ?? '';
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_buyers', action: 'view' },
  ]);
  const canCreateTicket =
    isStaffTicketsFeEnabled() && hasCap(user, 'staff_tickets', 'create') && leadId.trim().length > 0;
  const canEdit = hasCap(user, 'bds_buyers', 'edit');

  const [projectId, setProjectId] = useState(() => readBdsProjectId());
  const projectIdRef = useRef(projectId);
  const [rows, setRows] = useState<BdsBuyerRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [qualifyById, setQualifyById] = useState<Record<number, string>>({});
  const [visitAtById, setVisitAtById] = useState<Record<number, string>>({});
  const [visitNoteById, setVisitNoteById] = useState<Record<number, string>>({});

  useEffect(() => {
    const id = leadId.trim();
    if (id && /^\d+$/.test(id)) {
      router.replace(`/crm/leads/${id}`);
    }
  }, [leadId, router]);

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
      const data = await fetchBdsLeads(accessToken, id);
      if (projectIdRef.current === id) {
        setRows(data);
        setLoadError('');
      }
    } catch (err) {
      if (projectIdRef.current === id) {
        setLoadError(err instanceof Error ? err.message : 'Tải lead thất bại');
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
        const data = await fetchBdsLeads(token, projectId);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Tải lead thất bại');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, projectId]);

  const runAction = async (fn: () => Promise<unknown>) => {
    if (!token) return;
    setActionError('');
    try {
      await fn();
      await reload(token, projectId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Thao tác thất bại');
    }
  };

  const submitVisit = (id: number) => {
    if (!token) return;
    const scheduled = visitAtById[id]?.trim();
    if (!scheduled) return;
    const scheduledAt = new Date(scheduled);
    if (Number.isNaN(scheduledAt.getTime())) return;
    const staff_id = Number(user?.id);
    if (!Number.isInteger(staff_id) || staff_id <= 0) return;
    const note = visitNoteById[id]?.trim();
    void runAction(() =>
      postLeadVisit(token, id, {
        scheduled_at: scheduledAt.toISOString(),
        staff_id,
        ...(note ? { note } : {}),
      }),
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
      <HubPageLayout title="Lead khách mua" subtitle="Qualify · chạm · xem nhà">
        <div style={{ marginBottom: '0.75rem' }}>
          <Link href="/crm/cskh-board?flow=re_buyer" className="btn btn-sm btn-primary">
            Mở board CSKH
          </Link>
        </div>
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
                  href={`/crm/work?entity_type=lead&entity_id=${encodeURIComponent(leadId)}`}
                  className="btn btn-sm btn-primary"
                >
                  Tạo ticket
                </Link>
              </div>
            ) : null}
            {!loadError && projectId === 0 ? <p className="muted">Chọn dự án</p> : null}
            {!loadError && projectId > 0 && rows.length === 0 ? (
              <p className="muted">Chưa có lead</p>
            ) : null}
            {rows.length > 0 ? (
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Status</th>
                    <th>Nhận</th>
                    <th>Dự án</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      style={{ background: String(row.id) === leadId ? '#f5f5f5' : undefined }}
                    >
                      <td>{row.full_name}</td>
                      <td>{row.status}</td>
                      <td>{row.received_at ?? '—'}</td>
                      <td>{row.re_project_id ?? '—'}</td>
                      <td>
                        {canEdit && token ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => void runAction(() => postLeadTouch(token, row.id))}
                            >
                              Chạm
                            </button>{' '}
                            <select
                              value={qualifyById[row.id] ?? row.status}
                              onChange={(e) =>
                                setQualifyById((prev) => ({ ...prev, [row.id]: e.target.value }))
                              }
                            >
                              {QUALIFY_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>{' '}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                void runAction(() =>
                                  postLeadQualify(token, row.id, qualifyById[row.id] ?? row.status),
                                )
                              }
                            >
                              Qualify
                            </button>{' '}
                            <input
                              type="datetime-local"
                              value={visitAtById[row.id] ?? ''}
                              onChange={(e) =>
                                setVisitAtById((prev) => ({ ...prev, [row.id]: e.target.value }))
                              }
                            />{' '}
                            <input
                              placeholder="Ghi chú xem nhà"
                              value={visitNoteById[row.id] ?? ''}
                              onChange={(e) =>
                                setVisitNoteById((prev) => ({ ...prev, [row.id]: e.target.value }))
                              }
                            />{' '}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => submitVisit(row.id)}
                            >
                              Đặt xem nhà
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
