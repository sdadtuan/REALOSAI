export const AI_TOOLS_MIGRATION_VERSION = '2026-07-27-rnos33-ai-tools';

export interface AiToolApiKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  client_id: string | null;
  allowed_tools: string[];
  rate_limit_per_min: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface AiToolApiKeyCreateResult {
  id: string;
  plaintextKey: string;
  keyPrefix: string;
}

export interface AiToolCallLogInsert {
  apiKeyId?: string | null;
  toolName: string;
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  status: string;
  latencyMs?: number | null;
  agentRunId?: string | null;
}

export interface AiToolCallLogRecord {
  id: string;
  api_key_id: string | null;
  tool_name: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  status: string;
  latency_ms: number | null;
  agent_run_id: string | null;
  created_at: string;
}

/** MCP-compatible tool descriptor (registry metadata). */
export interface AiToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  mutating: boolean;
  requiredCaps: string[];
}

export interface AiToolApiKeyScope {
  id: string;
  client_id: string | null;
  allowed_tools: string[];
}

export interface AiToolCallContext {
  apiKey: AiToolApiKeyScope;
  actorId?: string | null;
  correlationId?: string | null;
}

export interface AiToolExecutionContext {
  apiKeyId: string;
  clientId: string | null;
  actorId: string | null;
  correlationId: string;
}

export interface AiToolDefinition extends AiToolDescriptor {
  handler: (
    input: Record<string, unknown>,
    context: AiToolExecutionContext,
  ) => Promise<unknown>;
}
