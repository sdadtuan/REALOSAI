export type AgencyKind =
  | 'inhouse'
  | 'tong_dai_ly'
  | 'f1'
  | 'f2'
  | 'alliance'
  | 'ctv_network';

export type AgencyStatus =
  | 'prospect'
  | 'onboarding'
  | 'active'
  | 'probation'
  | 'suspended'
  | 'terminated';

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';
export type BasketExclusivity = 'exclusive' | 'shared';
export type RevokeReason = 'rank_drop' | 'manual' | 'phase_close' | 'contract_end';

export const TIER_SEED: ReadonlyArray<{
  code: string;
  name: string;
  min_score: number;
  max_concurrent_holds: number;
  exclusive_allowed: boolean;
  ttl_multiplier: number;
}> = [
  { code: 'trial', name: 'Thử nghiệm', min_score: 0, max_concurrent_holds: 3, exclusive_allowed: false, ttl_multiplier: 1 },
  { code: 'bronze', name: 'Đồng', min_score: 20, max_concurrent_holds: 8, exclusive_allowed: false, ttl_multiplier: 1 },
  { code: 'silver', name: 'Bạc', min_score: 45, max_concurrent_holds: 20, exclusive_allowed: false, ttl_multiplier: 1.5 },
  { code: 'gold', name: 'Vàng', min_score: 70, max_concurrent_holds: 50, exclusive_allowed: true, ttl_multiplier: 2 },
  { code: 'strategic', name: 'Chiến lược', min_score: 90, max_concurrent_holds: 200, exclusive_allowed: true, ttl_multiplier: 3 },
];

export type TierRow = {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  min_score: number;
  max_concurrent_holds: number;
  exclusive_allowed: boolean;
  ttl_multiplier: number;
  created_at: Date;
  updated_at: Date;
};

export type AgencyRow = {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  legal_name: string;
  tax_id: string;
  kind: AgencyKind;
  parent_agency_id: string | null;
  status: AgencyStatus;
  tier_id: string | null;
  tier_override: boolean;
  tier_override_reason: string;
  tier_override_until: Date | null;
  owner_staff_id: number | null;
  created_at: Date;
  updated_at: Date;
};

export type ContractRow = {
  id: string;
  agency_id: string;
  project_id: number;
  status: ContractStatus;
  signed_on: Date | null;
  expires_on: Date | null;
  exclusive_project: boolean;
  max_concurrent_holds: number | null;
  created_at: Date;
  updated_at: Date;
};

export type BasketRuleRow = {
  id: string;
  agency_id: string;
  project_id: number;
  scope_type: string;
  exclusivity: BasketExclusivity;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export type BasketUnitRow = {
  id: string;
  rule_id: string;
  agency_id: string;
  project_id: number;
  product_id: number;
  exclusivity: BasketExclusivity;
  granted_at: Date;
  granted_by: string;
  revoked_at: Date | null;
  revoke_reason: string;
  created_at: Date;
};
