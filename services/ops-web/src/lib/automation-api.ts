import { API_BASE, ApiError, parseJson } from '@/lib/api';

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export type AutomationWorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';
export type AutomationNodeType =
  | 'trigger'
  | 'ai_score'
  | 'ai_summarize'
  | 'delay'
  | 'assign_task'
  | 'condition';

export interface AutomationWorkflowRow {
  id: string;
  name: string;
  trigger_type: string;
  status: AutomationWorkflowStatus;
  version: number;
  definition_json: Record<string, unknown>;
  updated_at: string;
}

export interface AutomationWorkflowNode {
  id: string;
  workflow_id: string;
  node_key: string;
  node_type: AutomationNodeType;
  config_json: Record<string, unknown>;
  next_node_key: string | null;
  sort_order: number;
}

export interface WorkflowListEnvelope {
  data: { rows: AutomationWorkflowRow[]; total: number; limit: number; offset: number };
  meta: { request_id: string };
  errors: unknown[];
}

export interface WorkflowDetailEnvelope {
  data: { workflow: AutomationWorkflowRow; nodes: AutomationWorkflowNode[] };
  meta: { request_id: string };
  errors: unknown[];
}

export interface SimulateStep {
  node_key: string;
  node_type: string;
  status: 'ok' | 'skipped' | 'error';
  output?: Record<string, unknown>;
  error?: string;
}

export interface SimulateEnvelope {
  data: {
    workflow_id: string;
    dry_run: true;
    entity_type: string;
    entity_id: string;
    steps: SimulateStep[];
  };
  meta: { request_id: string };
  errors: unknown[];
}

async function automationFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  });
  const body = await parseJson<Record<string, unknown>>(res);
  if (!res.ok) {
    const msg =
      typeof body?.message === 'string'
        ? body.message
        : typeof body?.error === 'string'
          ? body.error
          : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return body as T;
}

export async function fetchAutomationWorkflows(
  token: string,
  params?: { limit?: number; offset?: number },
): Promise<WorkflowListEnvelope> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  const suffix = q.toString() ? `?${q}` : '';
  return automationFetch(token, `/api/v1/automation-workflows${suffix}`);
}

export async function fetchAutomationWorkflowById(token: string, id: string): Promise<WorkflowDetailEnvelope> {
  return automationFetch(token, `/api/v1/automation-workflows/${id}`);
}

export async function createAutomationWorkflow(
  token: string,
  body: { name?: string; trigger_event?: string },
): Promise<WorkflowDetailEnvelope> {
  return automationFetch(token, '/api/v1/automation-workflows', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateAutomationWorkflowNodes(
  token: string,
  id: string,
  nodes: Array<{
    node_key: string;
    node_type: AutomationNodeType;
    config_json?: Record<string, unknown>;
    next_node_key?: string | null;
    sort_order?: number;
  }>,
): Promise<WorkflowDetailEnvelope> {
  return automationFetch(token, `/api/v1/automation-workflows/${id}/nodes`, {
    method: 'PUT',
    body: JSON.stringify({ nodes }),
  });
}

export async function activateAutomationWorkflow(token: string, id: string): Promise<WorkflowDetailEnvelope> {
  return automationFetch(token, `/api/v1/automation-workflows/${id}/activate`, { method: 'POST' });
}

export async function simulateAutomationWorkflow(
  token: string,
  id: string,
  body: { lead_id: number },
): Promise<SimulateEnvelope> {
  return automationFetch(token, `/api/v1/automation-workflows/${id}/simulate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
