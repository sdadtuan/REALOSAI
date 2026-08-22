export const HANDOVER_CHECK_CODES = ['water', 'electric', 'interior', 'minutes'] as const;
export type HandoverCheckCode = (typeof HANDOVER_CHECK_CODES)[number];
export type CheckStatus = 'pending' | 'pass' | 'fail';
export type TitleStatus = 'not_started' | 'submitted' | 'issued' | 'handed_to_buyer';
export type AftersalesTicketKind = 'defect' | 'title' | 'other';
export type AftersalesTicketStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export type CheckInput = { item_code: string; status: string };

export type HandoverGateOpts = {
  waive: boolean;
  hasApproveCap?: boolean;
  waiveReason?: string;
};

export type HandoverCheckRow = {
  id: string;
  tenant_id: string | null;
  transaction_id: string;
  item_code: HandoverCheckCode;
  status: CheckStatus;
  note: string;
  checked_by: number | null;
  checked_at: Date | null;
};

export type AftersalesTicketRow = {
  id: string;
  tenant_id: string | null;
  transaction_id: string;
  kind: AftersalesTicketKind;
  status: AftersalesTicketStatus;
  title: string;
  body: string;
  opened_by: number | null;
  created_at: Date;
  updated_at: Date;
};

export type AftersalesBoardRow = {
  transaction_id: string;
  project_id: number;
  product_id: number;
  stage: string;
  contract_no: string;
  handover_appointment_at: Date | null;
  appointment_due: boolean;
  title_status: TitleStatus;
  checks_passed: number;
  checks_total: number;
  open_defects: number;
};

export type AftersalesDetail = {
  tx: import('../transactions/bds-tx.types').TxRow;
  checks: HandoverCheckRow[];
  tickets: AftersalesTicketRow[];
  appointment_due: boolean;
};
