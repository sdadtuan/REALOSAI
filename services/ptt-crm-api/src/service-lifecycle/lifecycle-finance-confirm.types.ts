export interface LifecycleFinanceConfirmRow {
  id: number;
  lifecycle_id: number;
  staff_id: number | null;
  staff_email: string;
  outstanding_vnd: number;
  ar_pending_vnd: number;
  ar_overdue_vnd: number;
  strict_mode: boolean;
  note: string | null;
  created_at: string;
}
