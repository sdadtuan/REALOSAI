export interface StaffNotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  link_href: string | null;
  read: boolean;
  created_at: string;
}

export interface CreateStaffNotificationInput {
  user_id: string;
  kind?: string;
  title: string;
  body?: string;
  link_href?: string | null;
  meta_json?: Record<string, unknown>;
}
