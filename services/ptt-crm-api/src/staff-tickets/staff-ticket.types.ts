export type TicketKind = 'dept' | 'cross';
export type TicketStatus = 'open' | 'in_progress' | 'blocked' | 'waiting' | 'done' | 'cancelled';
export type TicketPriority = 'p0' | 'p1' | 'p2' | 'p3';

export type CloseRequires =
  | { type: 'none' }
  | { type: 'installments_exist' }
  | { type: 'system_only' }
  | { type: 'comment_min'; min: number };

export type QueueSeed = {
  code: string;
  name: string;
  kind_default: TicketKind;
  assignee_dept_code: string | null;
  sla_minutes: number | null;
  sla_pauses_on_waiting: boolean;
  close_requires: CloseRequires;
  sensitivity: 'normal' | 'restricted';
};

export const QUEUE_SEEDS: readonly QueueSeed[] = [
  { code: 'cskh_first_touch', name: 'Chạm lead lần đầu', kind_default: 'cross', assignee_dept_code: 'ban_cskh_presales', sla_minutes: 15, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'normal' },
  { code: 'visit_book', name: 'Đặt lịch thăm', kind_default: 'cross', assignee_dept_code: 'ban_kd', sla_minutes: 48 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'normal' },
  { code: 'hold_f1_approve', name: 'Duyệt hold F1', kind_default: 'cross', assignee_dept_code: 'ban_kd', sla_minutes: 8 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'normal' },
  { code: 'collection_schedule', name: 'Lập lịch công nợ', kind_default: 'cross', assignee_dept_code: 'ban_tc_collection', sla_minutes: 4 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'installments_exist' }, sensitivity: 'restricted' },
  { code: 'vbtt_check', name: 'Checklist VBTT', kind_default: 'cross', assignee_dept_code: 'ban_phap_che', sla_minutes: 4 * 60, sla_pauses_on_waiting: true, close_requires: { type: 'none' }, sensitivity: 'restricted' },
  { code: 'hdmb_gate_legal', name: 'Cổng HĐMB — PC', kind_default: 'cross', assignee_dept_code: 'ban_phap_che', sla_minutes: 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'system_only' }, sensitivity: 'restricted' },
  { code: 'hdmb_gate_paid', name: 'Cổng HĐMB — Công nợ', kind_default: 'cross', assignee_dept_code: 'ban_tc_collection', sla_minutes: 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'system_only' }, sensitivity: 'restricted' },
  { code: 'legal_gate_phase', name: 'Cổng pháp lý đợt', kind_default: 'cross', assignee_dept_code: 'ban_phap_che', sla_minutes: 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'restricted' },
  { code: 'milestone_unlock', name: 'Mốc mở khóa', kind_default: 'cross', assignee_dept_code: 'ban_tc_collection', sla_minutes: 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'restricted' },
  { code: 'handover_book', name: 'Hẹn bàn giao', kind_default: 'cross', assignee_dept_code: 'ban_cskh_after', sla_minutes: 15 * 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'normal' },
  { code: 'commission_period', name: 'Bảng kê HH', kind_default: 'cross', assignee_dept_code: 'ban_tc_hh', sla_minutes: 3 * 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'restricted' },
  { code: 'claim_review', name: 'Duyệt claim MKT', kind_default: 'cross', assignee_dept_code: 'ban_phap_che', sla_minutes: 2 * 24 * 60, sla_pauses_on_waiting: true, close_requires: { type: 'none' }, sensitivity: 'restricted' },
  { code: 'basket_materialize', name: 'Materialize giỏ', kind_default: 'cross', assignee_dept_code: 'ban_san_pham', sla_minutes: 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'normal' },
  { code: 'ops_action', name: 'Việc họp / ops', kind_default: 'dept', assignee_dept_code: null, sla_minutes: 5 * 24 * 60, sla_pauses_on_waiting: false, close_requires: { type: 'comment_min', min: 10 }, sensitivity: 'normal' },
  { code: 'dept_backlog', name: 'Backlog ban', kind_default: 'dept', assignee_dept_code: null, sla_minutes: null, sla_pauses_on_waiting: false, close_requires: { type: 'none' }, sensitivity: 'normal' },
];

export type QueueRow = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  kind_default: TicketKind;
  assignee_dept_code: string | null;
  assignee_dept_id: number | null;
  sla_minutes: number | null;
  sla_pauses_on_waiting: boolean;
  close_requires: CloseRequires;
  sensitivity: 'normal' | 'restricted';
  created_at: Date;
};

export type TicketRow = {
  id: string;
  tenant_id: string;
  number: string;
  kind: TicketKind;
  queue_code: string;
  title: string;
  body: string;
  hidden?: boolean;
  status: TicketStatus;
  priority: TicketPriority;
  requester_staff_id: number;
  requester_dept_code: string | null;
  assignee_staff_id: number | null;
  assignee_dept_code: string | null;
  project_id: number | null;
  entity_type: string | null;
  entity_id: string | null;
  room_id: string | null;
  parent_id: string | null;
  sla_due_at: Date | null;
  sla_breached: boolean;
  blocked_reason: string;
  waiting_on: string;
  completed_at: Date | null;
  cancelled_reason: string;
  created_by: number | null;
  idempotency_key: string | null;
  created_at: Date;
};

export type CreateTicketBody = {
  kind: TicketKind;
  queue_code: string;
  title: string;
  body?: string;
  room_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  priority?: TicketPriority;
  project_id?: number | null;
  idempotency_key?: string | null;
};

export type ListTicketsFilter = {
  inbox?: 'mine' | 'dept_queue' | 'inbound' | 'outbound';
  queue?: string;
  overdue?: boolean;
  projectId?: number;
};
