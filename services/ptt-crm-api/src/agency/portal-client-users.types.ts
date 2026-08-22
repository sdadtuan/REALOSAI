export type PortalClientRole = 'viewer' | 'approver';

export interface PortalClientUserPublic {
  id: string;
  email: string;
  role: PortalClientRole;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortalClientUsersListResponse {
  ok: boolean;
  client_id: string;
  users: PortalClientUserPublic[];
  table_ready: boolean;
}

export interface CreatePortalClientUserBody {
  email: string;
  password?: string;
  role?: PortalClientRole;
  /** Default true — gửi email template thông tin đăng nhập khi PTT_PORTAL_EMAIL_NOTIFY=1 */
  send_email?: boolean;
}

export interface PortalCredentialsEmailDelivery {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export interface CreatePortalClientUserResponse {
  ok: boolean;
  user: PortalClientUserPublic;
  /** Present when server generated password (create or reset). Show once to AM for handover. */
  temporary_password?: string;
  email_delivery?: PortalCredentialsEmailDelivery;
}

export interface UpdatePortalClientUserBody {
  role?: PortalClientRole;
  active?: boolean;
}

export interface ResetPortalClientUserPasswordBody {
  password?: string;
  send_email?: boolean;
}

export interface ResetPortalClientUserPasswordResponse {
  ok: boolean;
  temporary_password?: string;
  email_delivery?: PortalCredentialsEmailDelivery;
}
