import {
  clearPresalesAiDraftMeta,
  parsePresalesAiDraftMeta,
  PRESALES_AI_DRAFT_AT_KEY,
  PRESALES_AI_DRAFT_BADGE_VI,
  stampPresalesAiDraftMeta,
} from './presales-ai-draft-meta.util';

describe('presales-ai-draft-meta.util', () => {
  it('stamps and parses ai draft meta', () => {
    const prof = stampPresalesAiDraftMeta({}, 'sp@test.vn');
    expect(prof[PRESALES_AI_DRAFT_AT_KEY]).toBeTruthy();
    const meta = parsePresalesAiDraftMeta(prof);
    expect(meta.is_ai_draft).toBe(true);
    expect(meta.badge_vi).toBe(PRESALES_AI_DRAFT_BADGE_VI);
    expect(meta.draft_by).toBe('sp@test.vn');
  });

  it('clears draft meta on manual review save', () => {
    const cleared = clearPresalesAiDraftMeta(
      stampPresalesAiDraftMeta({ segment: 'B2B' }, 'sp@test.vn'),
    );
    expect(parsePresalesAiDraftMeta(cleared).is_ai_draft).toBe(false);
    expect(cleared.segment).toBe('B2B');
  });
});
