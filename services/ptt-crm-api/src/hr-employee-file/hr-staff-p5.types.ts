export type HrStaffLifecycleStage =
  | 'offer'
  | 'onboard_docs'
  | 'probation'
  | 'official'
  | 'transfer'
  | 'notice'
  | 'offboard_hold'
  | 'archived';

export interface HrStaffDependentRow {
  id: number;
  staff_id: number;
  name: string;
  relation: string;
  dob: string | null;
  tax_dependent: boolean;
  cccd: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface HrStaffLifecycleRow {
  staff_id: number;
  stage: HrStaffLifecycleStage;
  stage_changed_on: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface HrLifecycleGateResult {
  ok: boolean;
  missing: string[];
}

export interface CreateHrStaffDependentBody {
  name?: string;
  relation?: string;
  dob?: string | null;
  tax_dependent?: boolean;
  cccd?: string;
  notes?: string;
}

export interface PatchHrStaffDependentBody extends CreateHrStaffDependentBody {}

export interface PatchHrStaffLifecycleBody {
  stage?: HrStaffLifecycleStage;
  stage_changed_on?: string | null;
  notes?: string;
}

export interface HrHubExpirySummary {
  wallet_expiring_staff: number;
  wallet_low_pct_staff: number;
  contract_expiring_staff: number;
  bhyt_expiring_staff: number;
  samples: HrHubExpirySample[];
}

export interface HrHubExpirySample {
  staff_id: number;
  name: string;
  internal_code: string;
  kind: 'wallet' | 'wallet_low' | 'contract' | 'bhyt';
  detail: string;
}
