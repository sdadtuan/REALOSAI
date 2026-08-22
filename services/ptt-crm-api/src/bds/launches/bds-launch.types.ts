export const DEFAULT_HOLD_TTL_SECONDS = 180;

export type LaunchStatus = 'draft' | 'open' | 'closed';
export type QueueStatus = 'waiting' | 'promoted' | 'cancelled';

export type LaunchRow = {
  id: string;
  tenant_id: string | null;
  project_id: number;
  phase_id: string | null;
  starts_at: Date | null;
  ends_at: Date | null;
  hold_ttl_seconds: number;
  price_list_id: number | null;
  status: LaunchStatus;
  opened_at: Date | null;
  closed_at: Date | null;
  created_at: Date;
};

export type QueueRow = {
  id: string;
  tenant_id: string | null;
  launch_id: string;
  product_id: number;
  lead_id: number;
  requested_by_staff_id: number | null;
  channel_partner_id: string;
  status: QueueStatus;
  created_at: Date;
};

export type WarRoomHold = {
  hold_id: string;
  product_id: number;
  lead_id: number;
  status: string;
  expires_at: Date | null;
  ttl_remaining_sec: number | null;
};

export type WarRoomResponse = {
  launch: LaunchRow;
  holds: WarRoomHold[];
  queues: QueueRow[];
  conflicts: Array<{ product_id: number; waiting: number }>;
};

export type CreateLaunchInput = {
  project_id: number;
  phase_id?: string | null;
  hold_ttl_seconds?: number;
  starts_at?: string | Date | null;
  ends_at?: string | Date | null;
  price_list_id?: number | null;
};

export type EnqueueConflictInput = {
  product_id: number;
  lead_id: number;
  tenant_id?: string | null;
  channel_partner_id?: string;
  requested_by_staff_id?: number | null;
};

export type PromoteNextOpts = {
  tenantId?: string;
  row_version: number;
};
