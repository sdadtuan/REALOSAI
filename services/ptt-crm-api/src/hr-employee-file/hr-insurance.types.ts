export type HrInsuranceStatus = 'active' | 'paused' | 'closed';

export type HrInsurancePeriodKind = 'bhxh' | 'bhtn';

export interface HrStaffInsuranceRow {
  staff_id: number;
  bhxh_book_no: string;
  bhxh_joined_on: string | null;
  bhxh_status: HrInsuranceStatus;
  bhxh_document_id: number | null;
  bhxh_document_title?: string | null;
  bhyt_card_no: string;
  bhyt_valid_from: string | null;
  bhyt_valid_to: string | null;
  bhyt_clinic_name: string;
  bhyt_document_id: number | null;
  bhyt_document_title?: string | null;
  bhtn_joined_on: string | null;
  bhtn_status: HrInsuranceStatus;
  bhtn_document_id: number | null;
  bhtn_document_title?: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface HrInsurancePeriodRow {
  id: number;
  staff_id: number;
  kind: HrInsurancePeriodKind;
  period_year: number;
  period_month: number;
  salary_base: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface HrInsuranceSummary {
  bhyt_valid_to: string | null;
  bhyt_expiring_soon: boolean;
}

export interface PutHrStaffInsuranceBody {
  bhxh_book_no?: string;
  bhxh_joined_on?: string | null;
  bhxh_status?: HrInsuranceStatus;
  bhxh_document_id?: number | null;
  bhyt_card_no?: string;
  bhyt_valid_from?: string | null;
  bhyt_valid_to?: string | null;
  bhyt_clinic_name?: string;
  bhyt_document_id?: number | null;
  bhtn_joined_on?: string | null;
  bhtn_status?: HrInsuranceStatus;
  bhtn_document_id?: number | null;
  notes?: string;
}

export interface CreateHrInsurancePeriodBody {
  kind?: HrInsurancePeriodKind;
  period_year?: number;
  period_month?: number;
  salary_base?: number | null;
  notes?: string;
}

export interface PatchHrInsurancePeriodBody extends CreateHrInsurancePeriodBody {}
