import type { ReviewQueueAiSummary } from './review-queue-intelligence.util';
import { computeReviewQueuePriority } from './review-queue-intelligence.util';

export interface ReviewQueueLlmItem {
  lead_id: number;
  summary_line: string;
  priority_score: number;
  suggested_owner_name: string | null;
  workload_note: string;
  suggest_reason: string;
}

const SYSTEM_PROMPT = `Bạn là trợ lý GDKD CSKH spa Meta 24h.
Phân tích inbox "Phải tra soát" và trả JSON:
{
  "items": [
    {
      "lead_id": number,
      "summary_line": "1 dòng tiếng Việt",
      "priority_score": 1-5,
      "suggested_owner_name": "tên NV hoặc null",
      "workload_note": "ghi chú workload ngắn",
      "suggest_reason": "lý do gán"
    }
  ]
}
priority_score: 5 = chờ lâu nhất / rủi ro cao. Không auto-send khách — chỉ gợi ý nội bộ.`;

export function reviewQueueTriageSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

function clampPriority(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function parseReviewQueueLlmOutput(
  raw: Record<string, unknown>,
  rulesBase: ReviewQueueAiSummary[],
): ReviewQueueAiSummary[] {
  const items = Array.isArray(raw.items) ? raw.items : [];
  const byLead = new Map<number, ReviewQueueLlmItem>();

  for (const entry of items) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const leadId = Number(row.lead_id);
    if (!Number.isFinite(leadId) || leadId <= 0) continue;
    const base = rulesBase.find((s) => s.lead_id === leadId);
    const fallbackPriority = computeReviewQueuePriority(
      base ? parseHoursFromSummary(base.summary_line) : null,
    );
    byLead.set(leadId, {
      lead_id: leadId,
      summary_line: String(row.summary_line ?? base?.summary_line ?? '').trim() || base?.summary_line || '',
      priority_score: clampPriority(row.priority_score, fallbackPriority),
      suggested_owner_name:
        row.suggested_owner_name == null ? null : String(row.suggested_owner_name).trim() || null,
      workload_note: String(row.workload_note ?? '').trim(),
      suggest_reason: String(row.suggest_reason ?? base?.suggest_reason ?? '').trim() || base?.suggest_reason || '',
    });
  }

  return rulesBase.map((base) => {
    const llm = byLead.get(base.lead_id);
    if (!llm) {
      return {
        ...base,
        priority_score: computeReviewQueuePriority(parseHoursFromSummary(base.summary_line)),
        triage_source: 'rules' as const,
      };
    }
    const ownerName = llm.suggested_owner_name ?? base.suggested_owner_name;
    return {
      ...base,
      summary_line: llm.summary_line || base.summary_line,
      suggested_owner_name: ownerName,
      suggest_reason: llm.suggest_reason || base.suggest_reason,
      priority_score: llm.priority_score,
      workload_note: llm.workload_note || undefined,
      triage_source: 'llm' as const,
    };
  });
}

export function buildReviewQueueTriageStub(rulesBase: ReviewQueueAiSummary[]): ReviewQueueAiSummary[] {
  return rulesBase.map((base) => ({
    ...base,
    priority_score: computeReviewQueuePriority(parseHoursFromSummary(base.summary_line)),
    workload_note: base.suggested_owner_name
      ? `Stub: cân nhắc gán ${base.suggested_owner_name}`
      : 'Stub: giữ owner hiện tại',
    triage_source: 'llm_stub' as const,
  }));
}

function parseHoursFromSummary(summaryLine: string): number | null {
  const match = summaryLine.match(/Chờ (\d+)h/);
  return match ? Number(match[1]) : null;
}

export type { ReviewQueueAiSummary };
