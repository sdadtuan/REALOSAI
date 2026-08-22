import { piiHint } from './evidence-immutable.util';
import { assertPaidEstimateTier } from './competitor-snapshot.util';
import type { TalkwalkerSourceCandidate } from './market-research.types';

export const TALKWALKER_LIMITATION_NOTE =
  'Talkwalker mentions — hội thoại công khai, không phải census. Cấm suy “người Việt nghĩ rằng…”. Không suy mentions = population.';

const MAX_SNIPPET = 500;

export function mapTalkwalkerResponse(raw: unknown): TalkwalkerSourceCandidate[] {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rows = Array.isArray(obj.results) ? obj.results : [];
  const out: TalkwalkerSourceCandidate[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const url = String(item.url ?? '').trim();
    const title = String(item.title ?? '').trim();
    const snippet = String(item.snippet ?? '').trim().slice(0, MAX_SNIPPET);
    if (!url || !title) continue;
    if (snippet && piiHint(snippet)) continue;
    const candidate: TalkwalkerSourceCandidate = {
      url,
      title: title.slice(0, 500),
      publisher: 'Talkwalker',
      reliability_tier: 'medium',
      limitation_note: TALKWALKER_LIMITATION_NOTE,
      snippet,
    };
    assertPaidEstimateTier(candidate);
    out.push(candidate);
  }
  return out;
}
