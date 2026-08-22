export type CustomFieldEntityType = 'lead' | 'customer' | 'case';
export type CustomFieldType = 'text' | 'number' | 'select' | 'date' | 'boolean';

export interface CustomFieldDef {
  id: number;
  entity_type: CustomFieldEntityType;
  field_key: string;
  label: string;
  field_type: CustomFieldType;
  options: string[];
  required: boolean;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomFieldBody {
  entity_type: CustomFieldEntityType;
  field_key: string;
  label: string;
  field_type?: CustomFieldType;
  options?: string[];
  required?: boolean;
  sort_order?: number;
  active?: boolean;
}

export interface UpdateCustomFieldBody {
  label?: string;
  field_type?: CustomFieldType;
  options?: string[];
  required?: boolean;
  sort_order?: number;
  active?: boolean;
}

export interface PipelineStageDef {
  id: number;
  pipeline_key: string;
  stage_key: string;
  label: string;
  sort_order: number;
  sla_hours: number;
  owner_role: string;
  is_terminal: boolean;
  active: boolean;
  updated_at: string;
}

export interface UpdatePipelineStagesBody {
  stages: Array<{
    stage_key: string;
    label: string;
    sort_order?: number;
    sla_hours?: number;
    owner_role?: string;
    is_terminal?: boolean;
    active?: boolean;
  }>;
}

export interface CreatePipelineStageBody {
  stage_key?: string;
  label: string;
  sort_order?: number;
  sla_hours?: number;
  owner_role?: string;
  is_terminal?: boolean;
  active?: boolean;
}

export interface PatchPipelineStageBody {
  label?: string;
  sort_order?: number;
  sla_hours?: number;
  owner_role?: string;
  is_terminal?: boolean;
  active?: boolean;
}

export interface SalesPipelineConfig {
  pipeline_key: string;
  stages: PipelineStageDef[];
  stage_keys: string[];
  labels: Record<string, string>;
  sla_hours: Record<string, number>;
  owner_roles: Record<string, string>;
  terminal_stages: Set<string>;
}

export type LeadLookupKind = 'source' | 'channel';

export interface LeadLookupOption {
  id: number;
  kind: LeadLookupKind;
  option_key: string;
  label: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateLeadLookupBody {
  kind: LeadLookupKind;
  option_key?: string;
  label: string;
  sort_order?: number;
  active?: boolean;
}

export interface UpdateLeadLookupBody {
  label?: string;
  sort_order?: number;
  active?: boolean;
}
