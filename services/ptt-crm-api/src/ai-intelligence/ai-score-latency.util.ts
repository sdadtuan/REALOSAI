/** Score latency metrics — Gate R1 #1 (lead created → score ≤30s). */

export interface ScoreLatencyMetrics {
  window_days: number;
  scored_leads: number;
  within_30s_count: number;
  within_30s_pct: number;
  p95_latency_sec: number;
  gate_pass: boolean;
  gate_target_sec: number;
  agent_runs_p95_ms: number | null;
  narrative: string;
}

export function buildScoreLatencyMetrics(input: {
  windowDays: number;
  scoredLeads: number;
  within30s: number;
  p95Sec: number;
  agentRunsP95Ms: number | null;
  targetSec?: number;
}): ScoreLatencyMetrics {
  const target = input.targetSec ?? 30;
  const pct =
    input.scoredLeads > 0 ? Math.round((input.within30s / input.scoredLeads) * 1000) / 10 : 0;
  const pass = input.scoredLeads > 0 && input.p95Sec <= target && pct >= 80;

  const parts: string[] = [];
  if (input.scoredLeads === 0) {
    parts.push('Chưa có lead được score trong cửa sổ — chạy ingest + worker score_lead.');
  } else {
    parts.push(
      `${pct}% score trong ${target}s (p95=${Math.round(input.p95Sec)}s, n=${input.scoredLeads}).`,
    );
    if (input.agentRunsP95Ms != null) {
      parts.push(`ai_agent_runs score_lead P95=${Math.round(input.agentRunsP95Ms)}ms.`);
    }
  }

  return {
    window_days: input.windowDays,
    scored_leads: input.scoredLeads,
    within_30s_count: input.within30s,
    within_30s_pct: pct,
    p95_latency_sec: Math.round(input.p95Sec * 10) / 10,
    gate_pass: pass,
    gate_target_sec: target,
    agent_runs_p95_ms: input.agentRunsP95Ms,
    narrative: parts.join(' '),
  };
}
