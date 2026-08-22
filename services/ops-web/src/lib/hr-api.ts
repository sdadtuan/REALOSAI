import { API_BASE, parseJson, ApiError } from '@/lib/api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export interface PayslipRow {
  payroll_id: unknown;
  year: number;
  month: number;
  payroll_status?: string;
  net_pay?: number;
  gross_pay?: number;
  total_deductions?: number;
  workdays_actual?: number;
}

export interface LeaveRequestRow {
  id: string;
  staff_user_id: string;
  staff_email: string;
  leave_type: string;
  date_from: string;
  date_to: string;
  reason: string;
  status: string;
  approver_email: string | null;
  approved_at: string | null;
  audit_note: string | null;
  created_at: string;
}

export interface StaffNotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  link_href: string | null;
  read: boolean;
  created_at: string;
}

export async function fetchMyPayslips(token: string): Promise<{ payslips: PayslipRow[]; read_only: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/payroll/me/payslips`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<{ payslips: PayslipRow[]; read_only?: boolean; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải được payslip', res.status);
  return { payslips: body.payslips ?? [], read_only: body.read_only !== false };
}

export function payslipDownloadUrl(year: number, month: number): string {
  const qs = new URLSearchParams({ year: String(year), month: String(month) });
  return `${API_BASE}/api/v1/payroll/me/payslips/download.xlsx?${qs.toString()}`;
}

export async function downloadMyPayslipXlsx(
  token: string,
  year: number,
  month: number,
): Promise<void> {
  const res = await fetch(payslipDownloadUrl(year, month), {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await parseJson<{ error?: string; message?: string }>(res);
    throw new ApiError(body.error ?? body.message ?? 'Download failed', res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payslip-${year}-${String(month).padStart(2, '0')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchLeaveRequests(
  token: string,
): Promise<{ mine: LeaveRequestRow[]; pending: LeaveRequestRow[]; can_approve: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/leave/requests`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<{
    mine?: LeaveRequestRow[];
    pending?: LeaveRequestRow[];
    can_approve?: boolean;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải đơn nghỉ', res.status);
  return {
    mine: body.mine ?? [],
    pending: body.pending ?? [],
    can_approve: Boolean(body.can_approve),
  };
}

export async function createLeaveRequest(
  token: string,
  payload: { leave_type?: string; date_from: string; date_to: string; reason?: string },
): Promise<LeaveRequestRow> {
  const res = await fetch(`${API_BASE}/api/v1/hr/leave/requests`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ request?: LeaveRequestRow; error?: string; message?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? body.message ?? 'Gửi đơn thất bại', res.status);
  return body.request!;
}

export async function approveLeaveRequest(
  token: string,
  id: string,
  payload: { status?: 'approved' | 'rejected'; audit_note?: string },
): Promise<LeaveRequestRow> {
  const res = await fetch(`${API_BASE}/api/v1/hr/leave/requests/${id}/approve`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ request?: LeaveRequestRow; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Duyệt thất bại', res.status);
  return body.request!;
}

export async function fetchStaffNotifications(
  token: string,
  opts?: { unread?: boolean; limit?: number },
): Promise<{ notifications: StaffNotificationRow[]; unread: number }> {
  const qs = new URLSearchParams();
  if (opts?.unread) qs.set('unread', '1');
  if (opts?.limit) qs.set('limit', String(opts.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/staff/notifications${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<{
    notifications?: StaffNotificationRow[];
    unread?: number;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải thông báo', res.status);
  return { notifications: body.notifications ?? [], unread: body.unread ?? 0 };
}

export async function markStaffNotificationRead(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/staff/notifications/${id}/read`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await parseJson<{ error?: string }>(res);
    throw new ApiError(body.error ?? 'Mark read failed', res.status);
  }
}
