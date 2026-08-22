export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export type RoomKind = 'dept' | 'cross' | 'dm' | 'huddle';
export type RoomStatus = 'active' | 'archived';
export type RoomSensitivity = 'normal' | 'restricted';
export type MemberRole = 'owner' | 'member' | 'readonly';
export type MessageKind = 'text' | 'system' | 'entity_card';

export type RoomRow = {
  id: string;
  tenant_id: string;
  kind: RoomKind;
  code: string;
  name: string;
  department_id: number | null;
  project_id: number | null;
  sensitivity: RoomSensitivity;
  status: RoomStatus;
  created_by: number | null;
  expires_at: Date | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: Date;
};

export type MemberRow = {
  room_id: string;
  staff_id: number;
  role: MemberRole;
  joined_at: Date;
  muted: boolean;
  last_read_message_id: string | null;
};

export type MessageRow = {
  id: string;
  room_id: string;
  author_staff_id: number | null;
  kind: MessageKind;
  body: string;
  reply_to_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  hidden: boolean;
  file_ids: unknown;
  edited_at: Date | null;
  tombstoned_at: Date | null;
  tombstone_reason: string;
  created_at: Date;
};

export const RESTRICTED_DEPT_CODES = ['ban_phap_che', 'ban_tc_collection', 'ban_tc_hh'] as const;

export const CROSS_ROOM_SEEDS: ReadonlyArray<{
  code: string;
  name: string;
  dept_codes: readonly string[];
}> = [
  { code: 'x_mkt_cskh', name: 'MKT × CSKH', dept_codes: ['ban_mkt', 'ban_cskh_presales'] },
  { code: 'x_cskh_kd', name: 'CSKH × KD', dept_codes: ['ban_cskh_presales', 'ban_kd', 'ban_kenh'] },
  { code: 'x_kenh_gdkd', name: 'Kênh × GĐKD', dept_codes: ['ban_kenh', 'ban_kd'] },
  { code: 'x_kd_collection', name: 'KD × Công nợ', dept_codes: ['ban_kd', 'ban_kenh', 'ban_tc_collection'] },
  { code: 'x_pc_kd', name: 'PC × KD', dept_codes: ['ban_phap_che', 'ban_kd'] },
  { code: 'x_pc_collection', name: 'PC × Công nợ', dept_codes: ['ban_phap_che', 'ban_tc_collection'] },
  {
    code: 'x_pm_ops',
    name: 'PM ops',
    dept_codes: ['ban_du_an', 'ban_kd', 'ban_phap_che', 'ban_tc_collection', 'ban_mkt', 'ban_cskh_after'],
  },
  { code: 'x_pm_after', name: 'PM × After', dept_codes: ['ban_du_an', 'ban_cskh_after'] },
  { code: 'x_after_collection', name: 'After × Công nợ', dept_codes: ['ban_cskh_after', 'ban_tc_collection'] },
  { code: 'x_kenh_hh', name: 'Kênh × HH', dept_codes: ['ban_kenh', 'ban_tc_hh'] },
  { code: 'x_mkt_pc', name: 'MKT × PC', dept_codes: ['ban_mkt', 'ban_phap_che'] },
];

export type CreateRoomBody = {
  kind: RoomKind;
  peer_staff_id?: number;
  name?: string;
  expires_at?: string | Date | null;
  member_staff_ids?: number[];
  code?: string;
};

export type PostMessageBody = {
  body?: string;
  reply_to_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  kind?: MessageKind;
  file_ids?: unknown;
  idempotency_key?: string | null;
};
