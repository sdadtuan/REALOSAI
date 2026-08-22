import { buildPlaybookAbMetrics } from '../leads/chot-closed-loop.util';
import {
  buildPlaybookRankResponse,
  inferChunkScriptSource,
  rankPlaybookChunks,
} from './playbook-closed-loop.util';

describe('playbook-closed-loop.util', () => {
  const abMetrics = buildPlaybookAbMetrics(
    [
      {
        lead_id: 1,
        call_script_source: 'ai_v1',
        deal_value_vnd: 5_000_000,
        closed_within_24h: true,
        received_at: '2026-07-01T08:00:00Z',
        closed_at: '2026-07-01T20:00:00Z',
      },
      {
        lead_id: 2,
        call_script_source: 'sop',
        deal_value_vnd: 0,
        closed_within_24h: false,
        received_at: '2026-07-02T08:00:00Z',
        closed_at: '2026-07-03T08:00:00Z',
      },
    ],
    30,
  );

  const chunks = [
    {
      playbook_id: 'pb-ai',
      playbook_title: 'CSKH Meta spa AI script',
      chunk_id: 'c-ai-1',
      chunk_title: 'Gọi lần đầu 15 phút',
      chunk_key: 'first-call-15m',
      body: 'Script AI copilot gọi Meta spa trong 15 phút, hoàn thành B2.',
      tags: ['nba', 'cskh'],
    },
    {
      playbook_id: 'pb-sop',
      playbook_title: 'Lead follow-up SOP',
      chunk_id: 'c-sop-1',
      chunk_title: 'MQL trong 48h',
      chunk_key: 'mql-48h',
      body: 'SOP chăm lead MQL trong 48h.',
      tags: ['lead'],
    },
  ];

  it('infers script source from chunk metadata', () => {
    expect(inferChunkScriptSource(chunks[0])).toBe('ai_v1');
    expect(inferChunkScriptSource(chunks[1])).toBe('sop');
  });

  it('ranks cskh_sla chunks by relevance + chot rate', () => {
    const ranked = rankPlaybookChunks(chunks, abMetrics, 'cskh_sla');
    expect(ranked[0].chunk_id).toBe('c-ai-1');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].chot_24h_rate).toBe(abMetrics.ai_v1.closed_within_24h_pct);
  });

  it('builds rank response payload', () => {
    const out = buildPlaybookRankResponse({ chunks, abMetrics, context: 'cskh_sla' });
    expect(out.ok).toBe(true);
    expect(out.playbook_rank.length).toBe(2);
    expect(out.ab_narrative.length).toBeGreaterThan(0);
  });
});
