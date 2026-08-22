import { buildScoreLatencyMetrics } from './ai-score-latency.util';

describe('ai-score-latency.util', () => {
  it('buildScoreLatencyMetrics passes gate when p95 <= 30 and coverage ok', () => {
    const m = buildScoreLatencyMetrics({
      windowDays: 7,
      scoredLeads: 20,
      within30s: 18,
      p95Sec: 24,
      agentRunsP95Ms: 4200,
    });
    expect(m.within_30s_pct).toBe(90);
    expect(m.gate_pass).toBe(true);
    expect(m.agent_runs_p95_ms).toBe(4200);
  });

  it('buildScoreLatencyMetrics fails gate when p95 too high', () => {
    const m = buildScoreLatencyMetrics({
      windowDays: 7,
      scoredLeads: 10,
      within30s: 5,
      p95Sec: 45,
      agentRunsP95Ms: null,
    });
    expect(m.gate_pass).toBe(false);
  });
});
