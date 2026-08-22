import { designBriefPdfBuffer, designBriefPdfFilename } from './content-production-export.util';
import type { CmktItemRow } from './content-marketing.types';

describe('content-production-export.util', () => {
  const item: CmktItemRow = {
    id: 42,
    lifecycle_id: 1,
    idea_id: null,
    parent_item_id: null,
    title: 'Design brief smoke',
    format: 'carousel',
    channel: 'instagram',
    funnel_goal: 'awareness',
    status: 'approved_internal',
    assignee_sp: null,
    assignee_qa: null,
    brief_json: { hook: 'Visual hook' },
    body_json: { markdown: 'Body', html: '', variants: [] },
    selected_variant_idx: null,
    quality_score_json: {},
    seo_bridge_id: null,
    email_bridge_id: null,
    production_json: { notes: 'Use brand palette' },
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

  it('designBriefPdfFilename includes item id', () => {
    expect(designBriefPdfFilename(42)).toBe('creative-brief-42.pdf');
  });

  it('designBriefPdfBuffer returns valid PDF header', () => {
    const buf = designBriefPdfBuffer(item);
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(100);
  });
});
