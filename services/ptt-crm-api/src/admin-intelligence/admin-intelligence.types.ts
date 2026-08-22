export type AdminScope = 'org' | 'rbac' | 'audit' | 'policy';

export type SimulateMatrixImpactBody = {
  position_id: number;
  patch: {
    added?: Array<{ section: string; action: string }>;
    removed?: Array<{ section: string; action: string }>;
  };
  include_break_glass?: boolean;
  limit?: number;
};

export type MatrixImpactSampleUser = {
  user_id: string;
  email: string;
  display_name: string;
  caps_removed: string[];
  caps_added: string[];
  menu_items_lost: string[];
};

export type MatrixImpactResult = {
  position_code: string;
  affected_user_count: number;
  sample_users: MatrixImpactSampleUser[];
  aggregate: {
    caps_removed_unique: string[];
    users_with_pii_loss: number;
  };
  elapsed_ms: number;
};

export type AdminPolicyCatalogRow = {
  id: string;
  description: string;
  enabled: boolean;
  rego_preview: string;
  bundle_version: string;
  rego_file?: string | null;
  updated_by?: string | null;
  updated_at?: string;
};

export type PatchAdminPolicyBody = {
  description?: string;
  enabled?: boolean;
};

export type EnvDiffSummary = {
  added: number;
  removed: number;
  changed: number;
};

export type EnvDiffMatrixRow = {
  position_code: string;
  added: string[];
  removed: string[];
};

export type EnvDiffResult = {
  id: string;
  summary: EnvDiffSummary;
  matrix_diff: EnvDiffMatrixRow[];
  org_diff?: Array<{ entity: string; field: string; from: unknown; to: unknown }>;
  severity: 'info' | 'warning' | 'critical';
  left_label: string;
  right_label: string;
  created_at: string;
};

export type CreateEnvDiffBody = {
  left_snapshot_id?: number;
  right_snapshot_id?: number;
  upload_json?: Record<string, unknown>;
  left_label?: string;
  right_label?: string;
};

export type AdminAiAgentPolicy = {
  agent_code: string;
  allowed_tools: string[];
  spend_cap_usd_monthly: number | null;
  pii_block_fields: string[];
  require_human_approval: boolean;
  updated_by?: string | null;
  updated_at?: string;
};

export type UpsertAdminAiPolicyBody = {
  allowed_tools?: string[];
  spend_cap_usd_monthly?: number | null;
  pii_block_fields?: string[];
  require_human_approval?: boolean;
};

export type ChangeRequestStatus = 'draft' | 'pending' | 'approved' | 'applied' | 'rejected';

export type AdminChangeRequest = {
  id: string;
  kind: string;
  entity_key: string;
  patch_json: Record<string, unknown>;
  impact_json?: Record<string, unknown> | null;
  status: ChangeRequestStatus;
  requester_email: string;
  approver_email?: string | null;
  approver_note?: string | null;
  applied_at?: string | null;
  created_at: string;
  updated_at?: string;
};

export type CreateChangeRequestBody = {
  kind?: string;
  entity_key: string;
  patch_json: Record<string, unknown>;
  impact_json?: Record<string, unknown>;
};

export type RejectChangeRequestBody = {
  note?: string;
};

export type CompliancePack = {
  code: string;
  label: string;
  description: string;
  permission_sets: string[];
  position_grants: Record<string, Array<{ section: string; action: string }>>;
  job_function_hints?: Record<string, string[]>;
};

export type CompliancePackPreview = {
  code: string;
  label: string;
  matrix_changes: EnvDiffMatrixRow[];
  permission_sets: string[];
  summary: EnvDiffSummary;
};

export type ServiceAccountSummary = {
  id: string;
  name: string;
  key_prefix: string;
  scoped_caps: string[];
  active: boolean;
  expires_at?: string | null;
  created_by: string;
  created_at: string;
  last_used_at?: string | null;
};

export type CreateServiceAccountBody = {
  name: string;
  scoped_caps?: string[];
  expires_at?: string | null;
};

export type LegalEntity = {
  id: number;
  code: string;
  name: string;
  tax_id?: string | null;
  country_code: string;
  active: boolean;
};

export type OrgBranch = {
  id: number;
  legal_entity_id: number;
  code: string;
  name: string;
  active: boolean;
  legal_entity_code?: string;
};

export type CreateLegalEntityBody = {
  code: string;
  name: string;
  tax_id?: string;
  country_code?: string;
};

export type PatchLegalEntityBody = Partial<CreateLegalEntityBody> & { active?: boolean };

export type CreateOrgBranchBody = {
  legal_entity_id: number;
  code: string;
  name: string;
};

export type PatchOrgBranchBody = Partial<Omit<CreateOrgBranchBody, 'legal_entity_id'>> & { active?: boolean };

export type PositionUserRow = {
  id: string;
  email: string;
  display_name: string;
  job_functions: string[];
};
