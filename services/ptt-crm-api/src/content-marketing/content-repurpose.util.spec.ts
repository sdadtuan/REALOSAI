import { BadRequestException } from '@nestjs/common';
import {
  assertRepurposeSource,
  normalizeRepurposeCount,
  resolveRepurposeTransform,
} from './content-repurpose.util';
import type { CmktItemRow } from './content-marketing.types';

const baseItem = (): CmktItemRow =>
  ({
    id: 1,
    lifecycle_id: 1,
    idea_id: null,
    parent_item_id: null,
    title: 'Blog master',
    format: 'blog',
    channel: 'website',
    funnel_goal: 'awareness',
    status: 'approved_internal',
    assignee_sp: null,
    assignee_qa: null,
    brief_json: {},
    body_json: { markdown: '# Hello\n\nBody text.' },
    selected_variant_idx: null,
    quality_score_json: {},
    seo_bridge_id: null,
    email_bridge_id: null,
    production_json: {},
    published_url: null,
    published_at: null,
    due_at: null,
    in_review_at: null,
    created_by: 'test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }) as CmktItemRow;

describe('content-repurpose.util', () => {
  it('allows approved blog with body', () => {
    expect(() => assertRepurposeSource(baseItem())).not.toThrow();
  });

  it('rejects non-blog source', () => {
    const bad = { ...baseItem(), channel: 'facebook', format: 'social_post' };
    expect(() => assertRepurposeSource(bad)).toThrow(BadRequestException);
  });

  it('resolves blog_to_social_fb transform', () => {
    const t = resolveRepurposeTransform(baseItem(), { channel: 'facebook', format: 'social_post' });
    expect(t.transform_type).toBe('blog_to_social_fb');
  });

  it('clamps repurpose count', () => {
    expect(normalizeRepurposeCount(0)).toBe(1);
    expect(normalizeRepurposeCount(9)).toBe(5);
  });
});
