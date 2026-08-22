import type { WorkTicket } from './api';

export const INBOX_EMPTY: Record<string, string> = {
  mine: 'Chưa có việc được giao cho bạn.',
  dept_queue: 'Queue ban trống — không có việc chờ nhận.',
  inbound: 'Không có việc inbound.',
  outbound: 'Chưa có việc liên ban đi ra.',
};

export const STATUS_LABEL: Record<string, string> = {
  open: 'Mở',
  in_progress: 'Đang làm',
  blocked: 'Bị chặn',
  waiting: 'Chờ',
  done: 'Xong',
  cancelled: 'Hủy',
};

export const PRIORITY_LABEL: Record<string, string> = {
  p0: 'P0',
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
};

export const KIND_LABEL: Record<string, string> = {
  dept: 'Trong ban',
  cross: 'Liên ban',
};

export const ENTITY_LABEL: Record<string, string> = {
  tx: 'Giao dịch',
  hold: 'Hold',
  lead: 'Lead',
  project: 'Dự án',
  launch: 'Ra quân',
  milestone: 'Mốc',
};

export type SlaVisual = {
  label: string;
  tone: 'ok' | 'warn' | 'error' | 'muted';
  pct: number;
};

export function ticketErrorMessage(code: string): { title: string; code: string } {
  switch (code) {
    case 'artifact':
      return {
        title: 'Chưa đủ hồ sơ để đóng ticket — kiểm tra lịch công nợ hoặc ghi chú bắt buộc.',
        code: 'artifact',
      };
    case 'system_only':
      return {
        title: 'Ticket cổng HĐMB chỉ hệ thống đóng khi giao dịch ký HĐMB.',
        code: 'system_only',
      };
    case 'assignee_dept':
      return { title: 'Người nhận phải thuộc ban xử lý.', code: 'assignee_dept' };
    case 'reason':
      return { title: 'Nhập lý do khi chuyển sang Chờ hoặc Bị chặn.', code: 'reason' };
    case 'status':
      return { title: 'Không thể chuyển trạng thái theo luồng hiện tại.', code: 'status' };
    default:
      return { title: code || 'Thao tác thất bại', code: code || 'error' };
  }
}

export function slaVisual(ticket: WorkTicket, now = Date.now()): SlaVisual {
  if (ticket.sla_breached) {
    return { label: 'Quá SLA', tone: 'error', pct: 100 };
  }
  if (!ticket.sla_due_at) {
    return { label: 'Không SLA', tone: 'muted', pct: 0 };
  }
  const due = new Date(ticket.sla_due_at).getTime();
  const remainingMs = due - now;
  if (remainingMs <= 0) {
    return { label: 'Quá hạn', tone: 'error', pct: 100 };
  }
  const hoursLeft = remainingMs / (60 * 60 * 1000);
  const pct = Math.min(100, Math.max(8, 100 - hoursLeft * 12));
  const tone = hoursLeft <= 1 ? 'error' : hoursLeft <= 4 ? 'warn' : 'ok';
  const label = new Date(due).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return { label, tone, pct };
}

export function entityChipLabel(ticket: WorkTicket): string | null {
  if (!ticket.entity_type || !ticket.entity_id) return null;
  const kind = ENTITY_LABEL[ticket.entity_type] ?? ticket.entity_type;
  const short = ticket.entity_id.slice(0, 8);
  return `${kind} · ${short}`;
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'open':
      return 'meta-badge meta-badge--muted';
    case 'in_progress':
      return 'meta-badge meta-badge--ok';
    case 'waiting':
      return 'meta-badge meta-badge--warn';
    case 'blocked':
      return 'meta-badge meta-badge--error';
    case 'done':
      return 'meta-badge meta-badge--ok';
    case 'cancelled':
      return 'meta-badge meta-badge--muted';
    default:
      return 'meta-badge meta-badge--muted';
  }
}

export function priorityBadgeClass(priority: string): string {
  if (priority === 'p0' || priority === 'p1') return 'meta-badge meta-badge--error';
  if (priority === 'p2') return 'meta-badge meta-badge--warn';
  return 'meta-badge meta-badge--muted';
}

export const STATUS_FLOW = ['open', 'in_progress', 'waiting', 'blocked', 'done'] as const;
