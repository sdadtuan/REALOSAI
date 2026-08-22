import { piiHint } from './evidence-immutable.util';
import { assertPaidEstimateTier } from './competitor-snapshot.util';
import type { SparkToroSourceCandidate } from './market-research.types';

export const SPARKTORO_LIMITATION_NOTE =
  'Ước lượng audience SparkToro — không phải census. Không suy “người Việt nghĩ rằng…”.';

const MAX_SNIPPET = 500;

export function mapSparkToroResponse(raw: unknown): SparkToroSourceCandidate[] {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rows = Array.isArray(obj.results) ? obj.results : [];
  const out: SparkToroSourceCandidate[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const url = String(item.url ?? '').trim();
    const title = String(item.title ?? '').trim();
    const snippet = String(item.snippet ?? '').trim().slice(0, MAX_SNIPPET);
    if (!url || !title) continue;
    if (snippet && piiHint(snippet)) continue;
    const candidate: SparkToroSourceCandidate = {
      url,
      title: title.slice(0, 500),
      publisher: 'SparkToro',
      reliability_tier: 'medium',
      limitation_note: SPARKTORO_LIMITATION_NOTE,
      snippet,
    };
    assertPaidEstimateTier(candidate);
    out.push(candidate);
  }
  return out;
}
