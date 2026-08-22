export type HrLaborContractKind = 'probation' | 'fixed' | 'indefinite' | 'seasonal' | 'service';

export type HrLaborContractStatus = 'draft' | 'active' | 'expired' | 'terminated' | 'superseded';

export interface HrLaborContractRow {
  id: number;
  staff_id: number;
  contract_no: string;
  kind: HrLaborContractKind;
  signed_on: string | null;
  effective_on: string | null;
  expires_on: string | null;
  salary_gross: number | null;
  currency: string;
  work_place: string;
  job_title_legal: string;
  status: HrLaborContractStatus;
  document_id: number | null;
  document_title?: string | null;
  notes: string;
  appendices: HrLaborContractAppendixRow[];
  created_at: string;
  updated_at: string;
}

export interface HrLaborContractAppendixRow {
  id: number;
  contract_id: number;
  appendix_no: string;
  signed_on: string | null;
  effective_on: string | null;
  summary: string;
  salary_gross: number | null;
  document_id: number | null;
  document_title?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HrLaborContractSummary {
  id: number;
  contract_no: string;
  kind: HrLaborContractKind;
  status: HrLaborContractStatus;
  effective_on: string | null;
  expires_on: string | null;
  expiring_soon: boolean;
}

export interface CreateHrLaborContractBody {
  contract_no?: string;
  kind?: HrLaborContractKind;
  signed_on?: string | null;
  effective_on?: string | null;
  expires_on?: string | null;
  salary_gross?: number | null;
  currency?: string;
  work_place?: string;
  job_title_legal?: string;
  status?: HrLaborContractStatus;
  document_id?: number | null;
  notes?: string;
}

export interface PatchHrLaborContractBody extends CreateHrLaborContractBody {}

export interface CreateHrLaborAppendixBody {
  appendix_no?: string;
  signed_on?: string | null;
  effective_on?: string | null;
  summary?: string;
  salary_gross?: number | null;
  document_id?: number | null;
}

export interface PatchHrLaborAppendixBody extends CreateHrLaborAppendixBody {}
