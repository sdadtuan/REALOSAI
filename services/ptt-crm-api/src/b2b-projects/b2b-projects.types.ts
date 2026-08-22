export interface B2bProjectRow {
  id: string;
  owner_company_id: string;
  code: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  business_hours_json: Record<string, unknown>;
  sla_json: Record<string, unknown>;
  commission_json: { first_touch_pct: number; closer_pct: number };
  ai_call_enabled: boolean;
  manual_ingest_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateB2bProjectBody {
  code: string;
  name: string;
}

export interface PatchB2bProjectBody {
  name?: string;
  status?: B2bProjectRow['status'];
  business_hours_json?: Record<string, unknown>;
  sla_json?: Record<string, unknown>;
  commission_json?: { first_touch_pct: number; closer_pct: number };
  ai_call_enabled?: boolean;
  manual_ingest_enabled?: boolean;
}

export interface B2bProjectPageInput {
  page_id: string;
  name?: string;
  token_ref?: string;
  active?: boolean;
  forms?: Array<{ form_id: string; name?: string; active?: boolean }>;
}

export interface B2bProjectChannelInput {
  channel_type: 'zalo' | 'webform' | 'api';
  external_key: string;
  label?: string;
  config_json?: Record<string, unknown>;
  active?: boolean;
}

export interface B2bProjectStaffInput {
  staff_id: number;
  assign_enabled?: boolean;
  sales_level?: string;
  role?: 'sales' | 'project_manager';
}
