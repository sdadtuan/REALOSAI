import { cosineSimilarity, embedPlaybookText, keywordScore } from '../playbooks/playbooks.types';
import { piiHint } from './evidence-immutable.util';
import { isInsightStale } from './insight-stale.util';
import {
  RAG_CORPUS_STATUSES,
  RAG_EMBED_DIMS,
  type RagCorpusStatus,
  type RagEmbedInput,
  type RagHit,
} from './market-research.types';

export function isRagCorpusStatus(status: string): status is RagCorpusStatus {
  return (RAG_CORPUS_STATUSES as readonly string[]).includes(status);
}

export function insightEmbedText(row: Pick<RagEmbedInput, 'statement' | 'observation'>): string {
  return `${row.statement ?? ''} ${row.observation ?? ''}`.replace(/\s+/g, ' ').trim();
}

export function embedInsightText(text: string, dims = RAG_EMBED_DIMS): number[] {
  return embedPlaybookText(text, dims);
}

export function shouldSkipRagEmbed(text: string): boolean {
  return !text.trim() || piiHint(text);
}

function themeFilterMatches(
  needle: string | undefined,
  codes: string[],
  synonyms: string[] = [],
): boolean {
  if (!needle) return true;
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  return (
    codes.some((code) => code.toLowerCase() === n) ||
    synonyms.some((syn) => syn.toLowerCase() === n)
  );
}

export function rankRagHits(
  query: string,
  rows: Array<
    RagEmbedInput & {
      project_id: number;
      embedding: number[];
      theme_codes: string[];
      theme_synonyms?: string[];
      valid_to?: string | null;
    }
  >,
  opts?: {
    theme_code?: string;
    limit?: number;
    minScore?: number;
    queryVec?: number[];
    corpusStatuses?: readonly string[];
    stale_only?: boolean;
  },
): RagHit[] {
  const minScore = opts?.minScore ?? 0.12;
  const limit = opts?.limit ?? 10;
  const queryVec = opts?.queryVec ?? embedInsightText(query);
  const allowed = opts?.corpusStatuses ?? RAG_CORPUS_STATUSES;
  const hits: RagHit[] = [];

  for (const row of rows) {
    if (!(allowed as readonly string[]).includes(row.status)) continue;
    if (!isRagCorpusStatus(row.status)) continue;
    if (!themeFilterMatches(opts?.theme_code, row.theme_codes, row.theme_synonyms)) continue;
    if (row.embedding.length !== queryVec.length) continue;
    const score = 0.7 * cosineSimilarity(queryVec, row.embedding) + 0.3 * keywordScore(query, row.statement);
    if (score < minScore) continue;
    const validTo = row.valid_to ?? null;
    hits.push({
      insight_id: row.insight_id,
      project_id: row.project_id,
      statement: row.statement,
      status: row.status,
      score,
      theme_codes: row.theme_codes,
      valid_to: validTo,
      is_stale: isInsightStale(validTo),
    });
  }

  hits.sort((a, b) => b.score - a.score);
  const pool = opts?.stale_only ? hits.filter((h) => h.is_stale) : hits.filter((h) => !h.is_stale);
  return pool.slice(0, limit);
}

export function parseRagStaleOnlyFlag(raw: unknown): boolean {
  if (raw === true || raw === 1) return true;
  const s = String(raw ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}
