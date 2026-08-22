import type { CallScriptSource, PlaybookAbMetrics } from '../leads/chot-closed-loop.util';

export type PlaybookRankContext = 'cskh_sla' | 'general';

export interface PlaybookChunkRankInput {
  playbook_id: string;
  playbook_title: string;
  chunk_id: string;
  chunk_title: string;
  chunk_key: string;
  body: string;
  category?: string;
  tags?: string[];
}

export interface RankedPlaybookChunk {
  playbook_id: string;
  playbook_title: string;
  chunk_id: string;
  chunk_title: string;
  chunk_key: string;
  chot_24h_rate: number;
  rank: number;
  rank_score: number;
}

export interface PlaybookRankResponse {
  ok: true;
  context: PlaybookRankContext;
  window_days: number;
  ab_narrative: string;
  playbook_rank: RankedPlaybookChunk[];
}

const CSKH_SLA_KEYWORDS = ['spa', 'meta', '15', 'b2', 'chốt', 'gọi', '24h', 'cskh', 'sla'];

export function inferChunkScriptSource(chunk: PlaybookChunkRankInput): CallScriptSource | null {
  const text = `${chunk.chunk_key} ${chunk.chunk_title} ${chunk.body} ${(chunk.tags ?? []).join(' ')}`.toLowerCase();
  if (text.includes('sop') || chunk.playbook_title.toLowerCase().includes('sop')) return 'sop';
  if (text.includes('ai script') || text.includes('copilot') || (chunk.tags ?? []).includes('nba')) {
    return 'ai_v1';
  }
  return null;
}

function chotRateForSource(abMetrics: PlaybookAbMetrics, source: CallScriptSource | null): number {
  if (source === 'ai_v1') return abMetrics.ai_v1.closed_within_24h_pct;
  if (source === 'sop') return abMetrics.sop.closed_within_24h_pct;
  return Math.max(abMetrics.ai_v1.closed_within_24h_pct, abMetrics.sop.closed_within_24h_pct);
}

function contextRelevance(chunk: PlaybookChunkRankInput, context: PlaybookRankContext): number {
  if (context === 'general') return 1;
  const text = `${chunk.chunk_title} ${chunk.body} ${chunk.chunk_key}`.toLowerCase();
  let score = 0;
  for (const kw of CSKH_SLA_KEYWORDS) {
    if (text.includes(kw)) score += 1;
  }
  return score;
}

export function rankPlaybookChunks(
  chunks: PlaybookChunkRankInput[],
  abMetrics: PlaybookAbMetrics,
  context: PlaybookRankContext = 'cskh_sla',
): RankedPlaybookChunk[] {
  const scored = chunks.map((chunk) => {
    const source = inferChunkScriptSource(chunk);
    const chot_24h_rate = chotRateForSource(abMetrics, source);
    const relevance = contextRelevance(chunk, context);
    const rank_score = relevance * 10 + chot_24h_rate;
    return { chunk, chot_24h_rate, rank_score };
  });

  scored.sort(
    (a, b) => b.rank_score - a.rank_score || b.chot_24h_rate - a.chot_24h_rate,
  );

  return scored.map(({ chunk, chot_24h_rate, rank_score }, idx) => ({
    playbook_id: chunk.playbook_id,
    playbook_title: chunk.playbook_title,
    chunk_id: chunk.chunk_id,
    chunk_title: chunk.chunk_title,
    chunk_key: chunk.chunk_key,
    chot_24h_rate,
    rank: idx + 1,
    rank_score,
  }));
}

export function buildPlaybookRankResponse(input: {
  chunks: PlaybookChunkRankInput[];
  abMetrics: PlaybookAbMetrics;
  context?: PlaybookRankContext;
}): PlaybookRankResponse {
  const context = input.context ?? 'cskh_sla';
  return {
    ok: true,
    context,
    window_days: input.abMetrics.window_days,
    ab_narrative: input.abMetrics.narrative,
    playbook_rank: rankPlaybookChunks(input.chunks, input.abMetrics, context),
  };
}

/** Map chunk_id → rank boost (top ranks get higher boost). */
export function playbookRankBoostMap(ranked: RankedPlaybookChunk[], topN = 8): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of ranked.slice(0, topN)) {
    map.set(row.chunk_id, Math.max(0, topN - row.rank + 1));
  }
  return map;
}
