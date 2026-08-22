export type StaffPermissionSetSummary = {
  id: number;
  code: string;
  name: string;
  active: boolean;
  grant_count: number;
};

export type StaffPermissionSetGrant = {
  section_id: string;
  action: string;
};

export type StaffPermissionSetDetail = {
  id: number;
  code: string;
  name: string;
  active: boolean;
  grants: StaffPermissionSetGrant[];
  matrix: import('../staff-permissions/staff-permissions.types').StaffPermissionMatrixRow[];
};

export type StaffPermissionSetsListResponse = {
  sets: StaffPermissionSetSummary[];
};

export type CreateStaffPermissionSetBody = {
  code: string;
  name: string;
};

export type PatchStaffPermissionSetBody = {
  name?: string;
  active?: boolean;
};

export type PutStaffPermissionSetGrantsBody = {
  grants: StaffPermissionSetGrant[];
};

export type StaffUserPermissionSetsResponse = {
  user_id: string;
  set_codes: string[];
};

export type PutStaffUserPermissionSetsBody = {
  set_codes: string[];
};
