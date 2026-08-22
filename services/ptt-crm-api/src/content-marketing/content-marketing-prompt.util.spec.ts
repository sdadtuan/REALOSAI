import {
  buildDraftStub,
  buildIdeasBulkStub,
  buildVariantsStub,
  normalizeDraftOutput,
  normalizeIdeasBulkOutput,
  normalizeVariantsOutput,
  resolvePromptProfile,
} from './content-marketing-prompt.util';
import type { CmktItemRow } from './content-marketing.types';

describe('content-marketing-prompt.util', () => {
  const item: CmktItemRow = {
    id: 1,
    lifecycle_id: 2,
    idea_id: null,
    parent_item_id: null,
    title: 'Launch post',
    format: 'social_post',
    channel: 'facebook',
    funnel_goal: 'engagement',
    status: 'draft',
    assignee_sp: null,
    assignee_qa: null,
    brief_json: { hook: 'Stop scrolling' },
    body_json: { markdown: '', html: '', variants: [] },
    selected_variant_idx: null,
    quality_score_json: {},
    seo_bridge_id: null,
    email_bridge_id: null,
    production_json: {},
    visual_status: 'not_needed',
    media_json: {},
    published_url: null,
    published_at: null,
    due_at: null,
    in_review_at: null,
    created_by: 'writer@test.vn',
    created_at: '',
    updated_at: '',
  };

  it('resolvePromptProfile maps facebook social_post', () => {
    expect(resolvePromptProfile('facebook', 'social_post')).toBe('social_fb');
  });

  it('buildDraftStub returns markdown', () => {
    const stub = buildDraftStub(item, { brand_name: 'Acme' }, { tone: 'professional_friendly' });
    const out = normalizeDraftOutput(stub, stub);
    expect(out.markdown.length).toBeGreaterThan(20);
    expect(out.markdown).toContain('Acme');
  });

  it('buildVariantsStub returns at least 3 variants', () => {
    const stub = buildVariantsStub(item, { variant_count: 3 });
    const variants = normalizeVariantsOutput(stub, stub, 3);
    expect(variants.length).toBeGreaterThanOrEqual(3);
  });

  it('buildIdeasBulkStub returns requested idea count', () => {
    const stub = buildIdeasBulkStub(
      { brand_name: 'Acme', pillars: [{ name: 'Launch', goal: 'awareness' }] },
      { idea_count: 30 },
    );
    const ideas = normalizeIdeasBulkOutput(stub, stub, 30);
    expect(ideas.length).toBe(30);
    expect(ideas[0]?.title.length).toBeGreaterThan(3);
  });
});
