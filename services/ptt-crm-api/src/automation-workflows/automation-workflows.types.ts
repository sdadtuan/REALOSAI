export type AutomationWorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';
export type AutomationTriggerType = 'event' | 'schedule' | 'manual' | 'webhook';

export type AutomationNodeType =
  | 'trigger'
  | 'condition'
  | 'delay'
  | 'assign_task'
  | 'send_message'
  | 'update_field'
  | 'create_opportunity'
  | 'create_ticket'
  | 'ai_score'
  | 'ai_summarize'
  | 'webhook'
  | 'approval';

export interface AutomationWorkflowRecord {
  id: string;
  client_id: string | null;
  name: string;
  trigger_type: AutomationTriggerType;
  status: AutomationWorkflowStatus;
  version: number;
  definition_json: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationWorkflowNodeRecord {
  id: string;
  workflow_id: string;
  node_key: string;
  node_type: AutomationNodeType;
  config_json: Record<string, unknown>;
  next_node_key: string | null;
  sort_order: number;
  created_at: string;
}

export interface AutomationApiEnvelope<T> {
  data: T;
  meta: { request_id: string };
  errors: unknown[];
}

export interface CreateWorkflowBody {
  name?: string;
  trigger_type?: AutomationTriggerType;
  trigger_event?: string;
}

export interface UpdateWorkflowBody {
  name?: string;
  trigger_type?: AutomationTriggerType;
  trigger_event?: string;
  status?: AutomationWorkflowStatus;
}

export interface UpsertWorkflowNodeBody {
  node_key?: string;
  node_type?: AutomationNodeType;
  config_json?: Record<string, unknown>;
  next_node_key?: string | null;
  sort_order?: number;
}

export interface SimulateWorkflowBody {
  entity_type?: string;
  entity_id?: string | number;
  lead_id?: number;
}

export interface SimulateNodeResult {
  node_key: string;
  node_type: AutomationNodeType;
  status: 'ok' | 'skipped' | 'error';
  output?: Record<string, unknown>;
  error?: string;
}

export interface SimulateWorkflowResponse {
  data: {
    workflow_id: string;
    dry_run: true;
    entity_type: string;
    entity_id: string;
    steps: SimulateNodeResult[];
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface WorkflowListResponse {
  data: {
    rows: AutomationWorkflowRecord[];
    total: number;
    limit: number;
    offset: number;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface WorkflowDetailResponse {
  data: {
    workflow: AutomationWorkflowRecord;
    nodes: AutomationWorkflowNodeRecord[];
  };
  meta: { request_id: string };
  errors: unknown[];
}
