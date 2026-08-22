export type AccessReviewCampaignStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export type AccessReviewScopeType = 'all' | 'department' | 'team' | 'permission_set';

export type AccessReviewItemDecision =
  | 'pending'
  | 'certified'
  | 'revoke_requested'
  | 'escalated'
  | 'deferred';

export type AccessReviewCampaign = {
  id: string;
  title: string;
  quarter: string;
  status: AccessReviewCampaignStatus;
  scope_type: AccessReviewScopeType;
  scope_ref: string | null;
  due_at: string;
  owner_email: string;
  launched_at: string | null;
  closed_at: string | null;
  item_counts: { pending: number; certified: number; revoke: number; total: number };
  created_at: string;
};

export type AccessReviewItem = {
  id: string;
  campaign_id: string;
  user_id: string;
  user_email: string;
  user_display_name: string;
  position_code: string | null;
  team_ids: number[];
  snapshot_json: Record<string, unknown>;
  decision: AccessReviewItemDecision;
  certifier_email: string | null;
  certifier_note: string | null;
  decided_at: string | null;
  days_until_due?: number | null;
  risk_flags?: string[];
};

export type CreateAccessReviewCampaignBody = {
  title: string;
  quarter?: string;
  scope_type?: AccessReviewScopeType;
  scope_ref?: string | null;
  due_at?: string;
  owner_email?: string;
};

export type PatchAccessReviewCampaignBody = Partial<CreateAccessReviewCampaignBody>;

export type PatchAccessReviewItemBody = {
  decision: AccessReviewItemDecision;
  note?: string;
};

export type StaleAccountRisk = 'orphaned_admin' | 'never_logged_in' | 'stale' | 'inactive';

export type StaleAccountRow = {
  user_id: string;
  email: string;
  display_name: string;
  active: boolean;
  account_kind: string;
  last_login_at: string | null;
  days_since_login: number | null;
  position_code: string | null;
  risk: StaleAccountRisk;
  admin_cap_count: number;
};

export type AdminIntegrationRow = {
  id: string;
  kind: 'webhook' | 'oauth' | 'auth';
  name: string;
  status: 'ok' | 'warning' | 'critical' | 'disabled';
  detail: string;
  redirect_href?: string;
};
