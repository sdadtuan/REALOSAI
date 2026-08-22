export type StaffOrgUserSummary = {
  id: string;
  email: string;
  display_name: string;
  position_id: number;
  position_code?: string;
  active?: boolean;
  crm_staff_id?: number;
  team_ids?: number[];
  team_codes?: string[];
  job_functions: string[];
  client_ids?: string[];
  account_kind?: string;
  expires_at?: string | null;
  last_login_at?: string | null;
};

export type StaffOrgUserDetail = StaffOrgUserSummary;

export type CreateStaffOrgUserBody = {
  email: string;
  display_name?: string;
  position_id: number;
  team_ids?: number[];
  functions?: string[];
  password?: string;
  crm_staff_id?: number;
  account_kind?: 'staff' | 'guest' | 'contractor';
  expires_at?: string | null;
  crm_staff?: {
    name?: string;
    display_name?: string;
    phone?: string;
    job_title?: string;
    internal_code?: string;
    department_id?: number | null;
  };
};

export type PatchStaffOrgUserBody = {
  display_name?: string;
  position_id?: number;
  team_ids?: number[];
  active?: boolean;
  password?: string;
  account_kind?: 'staff' | 'guest' | 'contractor';
  expires_at?: string | null;
};

export type OffboardStaffOrgUserBody = {
  reassign_to: number;
  deactivate?: boolean;
};

export type CreateStaffOrgUserResponse = {
  user: StaffOrgUserDetail;
  temp_password?: string;
};

export type OffboardStaffOrgUserResponse = {
  user: StaffOrgUserDetail;
  leads_reassigned: number;
};

export type PutStaffUserJobFunctionsBody = {
  functions?: string[];
};

export type PutStaffUserClientScopeBody = {
  client_ids?: string[];
};

export type StaffUserClientScopeResponse = {
  user_id: string;
  client_ids: string[];
};

export type ImportStaffUserClientScopeBody = {
  csv: string;
  dry_run?: boolean;
};

export type ImportStaffUserClientScopeRowPreview = {
  email: string;
  client_ids: string[];
  user_id?: string;
  error?: string;
};

export type ImportStaffUserClientScopeResponse = {
  ok: boolean;
  dry_run: boolean;
  rows: number;
  applied: number;
  preview: ImportStaffUserClientScopeRowPreview[];
  errors: string[];
};

export type StaffUserJobFunctionsResponse = {
  user_id: string;
  email: string;
  display_name: string;
  position_id: number;
  position_code?: string;
  functions: string[];
};

export type StaffUserEffectiveCapsResponse = {
  user_id: string;
  email: string;
  display_name: string;
  position_id: number;
  position_code?: string;
  job_functions: string[];
  permission_sets?: string[];
  caps: Array<{ section: string; action: string }>;
};

export type StaffDepartmentRow = {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  active: boolean;
};

export type StaffTeamRow = {
  id: number;
  code: string;
  name: string;
  department_id: number | null;
  department_code?: string;
  department_name?: string;
  active: boolean;
};

export type StaffOrgPositionRow = {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  department_id: number | null;
  department_code?: string;
  active: boolean;
};

export type CreateStaffDepartmentBody = {
  code: string;
  name: string;
  parent_id?: number | null;
};

export type PatchStaffDepartmentBody = {
  code?: string;
  name?: string;
  parent_id?: number | null;
  active?: boolean;
};

export type CreateStaffTeamBody = {
  code: string;
  name: string;
  department_id?: number | null;
};

export type PatchStaffTeamBody = {
  code?: string;
  name?: string;
  department_id?: number | null;
  active?: boolean;
};

export type PatchStaffOrgPositionBody = {
  name?: string;
  parent_id?: number | null;
  department_id?: number | null;
  active?: boolean;
};

export type StaffOrgAuditInput = {
  actor_email: string;
  entity_type: string;
  entity_id: string;
  action: string;
  diff_json?: Record<string, unknown>;
};

/** Flat node for org chart tree (reports_to_id from crm_staff). */
export type StaffOrgChartNode = {
  id: number;
  name: string;
  reports_to_id: number | null;
  department: string;
  job_title: string;
  position_code: string | null;
  active: boolean;
};
