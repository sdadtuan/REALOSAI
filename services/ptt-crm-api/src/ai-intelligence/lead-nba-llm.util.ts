/** NBA LLM fallback — parse structured action from model output. */

export const NBA_LLM_CONFIDENCE_THRESHOLD = 0.65;

export const NBA_LLM_ALLOWED_ACTIONS = [
  'call_back',
  'send_follow_up',
  'send_proposal',
  'escalate_gdkd',
  'log_call',
  'complete_b2',
  'set_chot_audit',
  'set_lost_reason',
] as const;

export type NbaLlmAction = (typeof NBA_LLM_ALLOWED_ACTIONS)[number];

export interface NbaLlmSuggestion {
  action: NbaLlmAction;
  reason: string;
  confidence: number;
  source: 'llm' | 'llm_stub';
}

export function parseNbaLlmOutput(raw: unknown): NbaLlmSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const action = String(obj.action ?? '')
    .trim()
    .toLowerCase();
  if (!NBA_LLM_ALLOWED_ACTIONS.includes(action as NbaLlmAction)) return null;
  const reason = String(obj.reason ?? '').trim();
  if (reason.length < 8) return null;
  const confidenceRaw = Number(obj.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(0.95, Math.max(0.5, confidenceRaw))
    : 0.72;
  return {
    action: action as NbaLlmAction,
    reason,
    confidence,
    source: 'llm',
  };
}

export function buildNbaLlmStub(input: {
  status?: string | null;
  channel?: string | null;
  stalledDays?: number;
}): NbaLlmSuggestion {
  const channel = String(input.channel ?? 'lead').trim() || 'lead';
  return {
    action: 'call_back',
    reason: `Gợi ý stub (chưa cấu hình LLM): liên hệ lại khách ${channel} — kiểm tra nhu cầu và bước tiếp theo.`,
    confidence: 0.62,
    source: 'llm_stub',
  };
}

export function shouldUseNbaLlmFallback(input: {
  rulesEmitted: boolean;
  rulesConfidence: number;
  force: boolean;
}): boolean {
  if (input.force) return false;
  if (!input.rulesEmitted) return true;
  return input.rulesConfidence < NBA_LLM_CONFIDENCE_THRESHOLD;
}
