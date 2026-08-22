'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmHrPageShell } from '@/components/crm/CrmHrPageShell';
import {
  approveLeaveRequest,
  createLeaveRequest,
  fetchLeaveRequests,
  type LeaveRequestRow,
} from '@/lib/hr-api';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { winLeaveLiteEnabled } from '@/lib/win/flags';

const LEAVE_TYPES = [
  { value: 'annual', label: 'Phép năm' },
  { value: 'sick', label: 'Ốm' },
  { value: 'unpaid', label: 'Không lương' },
  { value: 'other', label: 'Khác' },
];

function statusLabel(status: string): string {
  if (status === 'approved') return 'Đã duyệt';
  if (status === 'rejected') return 'Từ chối';
  if (status === 'cancelled') return 'Đã hủy';
  return 'Chờ duyệt';
}

export default function HrLeavePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mine, setMine] = useState<LeaveRequestRow[]>([]);
  const [pending, setPending] = useState<LeaveRequestRow[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [leaveType, setLeaveType] = useState('annual');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const canRequest =
    user &&
    (hasCap(user, 'crm_hr_leave', 'request') ||
      hasCap(user, 'crm_hr_leave', 'approve') ||
      hasCap(user, 'crm_staff_roster', 'view'));

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      setToken(access);
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      setToken(access);
      return access;
    }
  }, [router]);

  const reload = useCallback(async (access: string) => {
    const data = await fetchLeaveRequests(access);
    setMine(data.mine);
    setPending(data.pending);
    setCanApprove(data.can_approve);
  }, []);

  useEffect(() => {
    void ensureAuth().then(async (access) => {
      if (!access || !winLeaveLiteEnabled()) return;
      try {
        await reload(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải đơn nghỉ');
      }
    });
  }, [ensureAuth, reload]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !canRequest) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await createLeaveRequest(token, {
        leave_type: leaveType,
        date_from: dateFrom,
        date_to: dateTo,
        reason,
      });
      setMessage('Đã gửi đơn nghỉ.');
      setReason('');
      await reload(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi đơn thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onApprove(id: string, status: 'approved' | 'rejected') {
    if (!token) return;
    setError('');
    try {
      await approveLeaveRequest(token, id, { status });
      setMessage(status === 'approved' ? 'Đã duyệt đơn.' : 'Đã từ chối đơn.');
      await reload(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duyệt thất bại');
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!winLeaveLiteEnabled()) {
    return (
      <CrmHrPageShell user={user} onLogout={logout} title="Nghỉ phép lite">
        <p className="muted">WIN-4-D leave lite chưa bật (NEXT_PUBLIC_WIN_LEAVE_LITE).</p>
      </CrmHrPageShell>
    );
  }

  return (
    <CrmHrPageShell
      user={user}
      onLogout={logout}
      title="Nghỉ phép lite"
      subtitle="Gửi đơn & theo dõi trạng thái — duyệt stub trên CRM"
    >
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      {canRequest ? (
        <form className="card card--pad lead-form" onSubmit={(e) => void onSubmit(e)}>
          <h3>Gửi đơn nghỉ</h3>
          <div className="lead-form__grid">
            <label className="lead-field">
              <span className="lead-field__label">Loại</span>
              <select
                className="lead-select"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="lead-field">
              <span className="lead-field__label">Từ ngày</span>
              <input
                className="lead-input"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                required
              />
            </label>
            <label className="lead-field">
              <span className="lead-field__label">Đến ngày</span>
              <input
                className="lead-input"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                required
              />
            </label>
          </div>
          <label className="lead-field">
            <span className="lead-field__label">Lý do</span>
            <textarea
              className="lead-input lead-input--area"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-sm" disabled={saving}>
            {saving ? 'Đang gửi…' : 'Gửi đơn'}
          </button>
        </form>
      ) : (
        <p className="muted">Cần quyền crm_hr_leave.request để gửi đơn.</p>
      )}

      <h3 style={{ marginTop: '1.5rem' }}>Đơn của tôi</h3>
      <LeaveTable rows={mine} />

      {canApprove && pending.length ? (
        <>
          <h3 style={{ marginTop: '1.5rem' }}>Chờ duyệt</h3>
          <LeaveTable rows={pending} showActions onApprove={(id, st) => void onApprove(id, st)} />
        </>
      ) : null}
    </CrmHrPageShell>
  );
}

function LeaveTable({
  rows,
  showActions,
  onApprove,
}: {
  rows: LeaveRequestRow[];
  showActions?: boolean;
  onApprove?: (id: string, status: 'approved' | 'rejected') => void;
}) {
  if (!rows.length) {
    return <p className="muted">Không có đơn.</p>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Nhân viên</th>
            <th>Loại</th>
            <th>Từ — Đến</th>
            <th>Trạng thái</th>
            <th>Ghi chú</th>
            {showActions ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.staff_email}</td>
              <td>{row.leave_type}</td>
              <td>
                {row.date_from} → {row.date_to}
              </td>
              <td>{statusLabel(row.status)}</td>
              <td>{row.audit_note || row.reason || '—'}</td>
              {showActions && row.status === 'pending' ? (
                <td>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => onApprove?.(row.id, 'approved')}
                  >
                    Duyệt
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => onApprove?.(row.id, 'rejected')}
                  >
                    Từ chối
                  </button>
                </td>
              ) : showActions ? (
                <td />
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
