export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequestRow {
  id: string;
  staff_user_id: string;
  staff_email: string;
  leave_type: string;
  date_from: string;
  date_to: string;
  reason: string;
  status: LeaveStatus;
  approver_user_id: string | null;
  approver_email: string | null;
  approved_at: string | null;
  audit_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLeaveRequestBody {
  leave_type?: string;
  date_from: string;
  date_to: string;
  reason?: string;
}

export interface ApproveLeaveRequestBody {
  status?: 'approved' | 'rejected';
  audit_note?: string;
}
