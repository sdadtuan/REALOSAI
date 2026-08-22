'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import {
  approveChangeRequest,
  fetchChangeRequests,
  rejectChangeRequest,
  submitChangeRequest,
  type AdminChangeRequest,
} from '@/lib/api';
import { canViewPolicyAdmin, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

const STATUS_LABELS: Record<AdminChangeRequest['status'], string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  applied: 'Đã áp dụng',
  rejected: 'Từ chối',
};

function statusClass(status: AdminChangeRequest['status']): string {
  if (status === 'pending') return 'admin-approval-status--pending';
  if (status === 'rejected') return 'admin-audit-severity--critical';
  return '';
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export default function AdminPolicyApprovalsPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewPolicyAdmin);
  const [requests, setRequests] = useState<AdminChangeRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const out = await fetchChangeRequests(token, statusFilter ? { status: statusFilter } : undefined);
      setRequests(out.requests ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải hàng đợi duyệt thất bại');
    }
  }, [token, statusFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function runSubmit(id: string) {
    if (!token) return;
    setBusy(true);
    try {
      await submitChangeRequest(token, id);
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gửi duyệt thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function runApprove(id: string) {
    if (!token) return;
    setBusy(true);
    try {
      await approveChangeRequest(token, id);
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Duyệt thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function runReject(id: string) {
    if (!token) return;
    setBusy(true);
    try {
      await rejectChangeRequest(token, id, { note: rejectNote.trim() || undefined });
      setRejectId(null);
      setRejectNote('');
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Từ chối thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Duyệt thay đổi ma trận"
      subtitle="Quy tắc 2 người — PO tạo, Security/PO khác duyệt"
      breadcrumb={[
        { label: 'Quản trị', href: '/admin' },
        { label: 'Policies', href: '/admin/policies' },
        { label: 'Duyệt thay đổi' },
      ]}
      loading={loading}
    >
      <div className="admin-governance-page">
        {error ? <p className="form-error">{error}</p> : null}
        {loadError ? <p className="form-error">{loadError}</p> : null}

        <div className="admin-audit-filters">
          <label className="muted">
            Trạng thái
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} disabled={busy}>
              <option value="">Tất cả</option>
              <option value="draft">Nháp</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="applied">Đã áp dụng</option>
              <option value="rejected">Từ chối</option>
            </select>
          </label>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Entity</th>
              <th>Loại</th>
              <th>Trạng thái</th>
              <th>Người yêu cầu</th>
              <th>Thời gian</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {requests.map((row) => (
              <tr key={row.id}>
                <td>{row.entity_key}</td>
                <td>{row.kind}</td>
                <td className={statusClass(row.status)}>{STATUS_LABELS[row.status] ?? row.status}</td>
                <td>{row.requester_email}</td>
                <td className="muted">{formatWhen(row.created_at)}</td>
                <td>
                  {row.status === 'draft' ? (
                    <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void runSubmit(row.id)}>
                      Gửi duyệt
                    </button>
                  ) : null}
                  {row.status === 'pending' && user?.email !== row.requester_email ? (
                    <>
                      <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void runApprove(row.id)}>
                        Duyệt
                      </button>{' '}
                      <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setRejectId(row.id)}>
                        Từ chối
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {requests.length === 0 ? <p className="muted">Không có yêu cầu trong bộ lọc hiện tại.</p> : null}

        {rejectId ? (
          <div className="page-card stack-gap">
            <h3 className="section-title">Ghi chú từ chối</h3>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              className="kpi-input"
              placeholder="Lý do từ chối (tuỳ chọn)"
            />
            <div className="kpi-page__filters">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void runReject(rejectId)}>
                Xác nhận từ chối
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setRejectId(null)}>
                Huỷ
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
