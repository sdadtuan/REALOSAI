import { piiHint } from './evidence-immutable.util';
import { isRagCorpusStatus } from './research-rag.util';
import {
  RAG_COPILOT_HIT_LIMIT,
  type CopilotRagHit,
  type RagHit,
} from './market-research.types';
import type { InsightCopilotEvidence } from './market-research-copilot.prompt';

export function buildCopilotRagQuery(evidence: InsightCopilotEvidence[]): string {
  return evidence
    .map((row) =>
      [row.excerpt, row.locator, row.unit, row.geo].filter(Boolean).join(' '),
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

export function shouldSkipCopilotRag(query: string): boolean {
  return !query.trim() || piiHint(query);
}

export function toCopilotRagHits(hits: RagHit[]): CopilotRagHit[] {
  return hits
    .filter((hit) => isRagCorpusStatus(hit.status))
    .slice(0, RAG_COPILOT_HIT_LIMIT)
    .map((hit) => ({
      insight_id: hit.insight_id,
      statement: hit.statement,
      status: hit.status,
      score: hit.score,
      theme_codes: hit.theme_codes,
    }));
}
