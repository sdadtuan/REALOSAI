export type HrDocCategory =
  | 'identity'
  | 'contract'
  | 'insurance'
  | 'education'
  | 'cert'
  | 'license'
  | 'medical'
  | 'family'
  | 'other';

export type HrDocCardStatus =
  | 'valid'
  | 'expiring'
  | 'expired'
  | 'revoked'
  | 'replaced'
  | 'pending_review';

export type HrDocVisibility = 'hr_only' | 'manager' | 'self';

export interface HrDocTypeRow {
  type_code: string;
  label: string;
  category: HrDocCategory;
  is_system: boolean;
  is_required_onboard: boolean;
  is_required_official: boolean;
  sort_order: number;
}

export interface HrDocWalletFileRow {
  id: number;
  card_id: number;
  storage_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface HrDocWalletEducationRow {
  card_id: number;
  level: string;
  major: string;
  school: string;
  graduated_on: string | null;
  classification: string;
  training_form: string;
}

export interface HrDocWalletCardRow {
  id: number;
  staff_id: number;
  type_code: string;
  type_label?: string;
  type_category?: HrDocCategory;
  title: string;
  doc_no: string;
  issuer: string;
  issued_on: string | null;
  expires_on: string | null;
  status: HrDocCardStatus;
  visibility: HrDocVisibility;
  pinned: boolean;
  linked_entity: string;
  notes: string;
  submitted_by?: string;
  reviewed_by?: string;
  reviewed_at?: string | null;
  file_count: number;
  education: HrDocWalletEducationRow | null;
  files: HrDocWalletFileRow[];
  created_at: string;
  updated_at: string;
}

export interface CreateHrDocTypeBody {
  type_code: string;
  label: string;
  category?: HrDocCategory;
  is_required_onboard?: boolean;
  is_required_official?: boolean;
}

export interface CreateHrDocWalletCardBody {
  type_code: string;
  title?: string;
  doc_no?: string;
  issuer?: string;
  issued_on?: string | null;
  expires_on?: string | null;
  visibility?: HrDocVisibility;
  pinned?: boolean;
  linked_entity?: string;
  notes?: string;
  education?: Partial<HrDocWalletEducationRow>;
}

export interface PatchHrDocWalletCardBody {
  title?: string;
  doc_no?: string;
  issuer?: string;
  issued_on?: string | null;
  expires_on?: string | null;
  visibility?: HrDocVisibility;
  pinned?: boolean;
  linked_entity?: string;
  notes?: string;
  status?: HrDocCardStatus;
  deleted?: boolean;
  education?: Partial<HrDocWalletEducationRow>;
}

export interface HrWalletListQuery {
  category?: string;
  expiring_only?: boolean;
  education_only?: boolean;
  missing_files?: boolean;
  pending_review_only?: boolean;
  self_visible_only?: boolean;
}

export interface ApproveHrDocWalletCardBody {
  notes?: string;
}

export interface RejectHrDocWalletCardBody {
  notes?: string;
}

export interface HrWalletRosterStatRow {
  staff_id: number;
  wallet_pct: number;
  expiring_count: number;
}

export const HR_DOC_WALLET_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const HR_DOC_WALLET_MAX_FILES_PER_CARD = 20;

export const HR_SELF_SUBMIT_CATEGORIES = new Set<HrDocCategory>([
  'education',
  'cert',
  'license',
  'medical',
  'family',
  'other',
]);

export const HR_DOC_WALLET_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
