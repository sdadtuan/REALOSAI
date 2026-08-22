export type StaffPermissionActionDef = {
  id: string;
  label: string;
};

export type StaffPermissionSectionDef = {
  id: string;
  label: string;
  group: string;
  page: string;
  description: string;
};

export type StaffPermissionUiButtonDef = {
  id: string;
  label: string;
  parent_section: string;
  requires_action: string;
  page?: string;
  description?: string;
  kind?: string;
};

export type StaffPermissionCatalogDoc = {
  version: string;
  actions: StaffPermissionActionDef[];
  extra_actions: string[];
  extra_action_labels: Record<string, string>;
  section_actions: Record<string, string[]>;
  sections: StaffPermissionSectionDef[];
  ui_buttons: StaffPermissionUiButtonDef[];
  permission_ids: string[];
};

export type StaffPermissionMatrixRow = {
  section_id: string;
  section_label: string;
  group: string;
  page: string;
  description: string;
  row_kind: 'section' | 'ui_button';
  parent_section?: string;
  requires_action?: string;
  actions: string[];
  allowed: string[];
};

export type StaffPositionSummary = {
  id: number;
  code: string;
  name: string;
  active: boolean;
  grants_customized: boolean;
};

export type StaffPositionDetail = StaffPositionSummary & {
  grants: Record<string, string[]>;
  matrix: StaffPermissionMatrixRow[];
};

export type StaffPermissionAuditRow = {
  id: number;
  actor_email: string;
  position_id: number;
  position_code: string;
  diff_json: Record<string, unknown>;
  created_at: string;
};

export type PatchStaffPositionGrantsBody = {
  grants: Record<string, string[]>;
};

export type StaffJobFunctionSummary = {
  code: string;
  label: string;
  description: string;
  department_scope: string;
  sort_order: number;
  grants_customized: boolean;
};

export type StaffJobFunctionDetail = StaffJobFunctionSummary & {
  grants: Record<string, string[]>;
  matrix: StaffPermissionMatrixRow[];
};

export type PatchStaffJobFunctionGrantsBody = {
  grants: Record<string, string[]>;
};

export type StaffPermissionCap = {
  section_id: string;
  action: string;
};
