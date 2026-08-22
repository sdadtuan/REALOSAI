import { BadRequestException } from '@nestjs/common';
import {
  assertMediaJobEligible,
  assertVisualGateForPublish,
  computeVisualQaScore,
  itemNeedsVisualApproval,
  parseCarouselSlideTexts,
  resolveAspectRatio,
  resolveChannelSpec,
} from './content-media.util';
import type { CmktItemRow } from './content-marketing.types';

const baseItem = (): CmktItemRow =>
  ({
    id: 1,
    lifecycle_id: 1,
    idea_id: null,
    parent_item_id: null,
    title: 'Carousel',
    format: 'carousel',
    channel: 'facebook',
    funnel_goal: '',
    status: 'approved_internal',
    assignee_sp: null,
    assignee_qa: null,
    brief_json: {},
    body_json: { markdown: 'Slide 1\nSlide 2\nSlide 3' },
    selected_variant_idx: null,
    quality_score_json: {},
    seo_bridge_id: null,
    email_bridge_id: null,
    production_json: { phase: 'awaiting_design' },
    visual_status: 'not_needed',
    media_json: {},
    published_url: null,
    published_at: null,
    due_at: null,
    in_review_at: null,
    created_by: 't',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }) as CmktItemRow;

describe('content-media.util', () => {
  it('detects carousel needs visual approval', () => {
    expect(itemNeedsVisualApproval(baseItem())).toBe(true);
  });

  it('blocks media job before copy approved', () => {
    const draft = { ...baseItem(), status: 'draft' };
    expect(() => assertMediaJobEligible(draft)).toThrow(BadRequestException);
    expect(() => assertMediaJobEligible(draft, true)).not.toThrow();
  });

  it('blocks publish without visual approved when media enabled', () => {
    const item = { ...baseItem(), visual_status: 'ai_ready' as const };
    expect(() => assertVisualGateForPublish(item, true)).toThrow(BadRequestException);
    expect(() =>
      assertVisualGateForPublish({ ...item, visual_status: 'approved' }, true),
    ).not.toThrow();
  });

  it('parses carousel slides and scores QA', () => {
    const slides = parseCarouselSlideTexts('A\nB\nC');
    expect(slides.length).toBe(3);
    const qa = computeVisualQaScore([{ id: '1', type: 'image', url: 'u', ai_generated: true, provider: 'stub' }]);
    expect(qa.score).toBeGreaterThanOrEqual(50);
  });

  it('resolves channel spec from aspect ratio', () => {
    expect(resolveChannelSpec(resolveAspectRatio('9:16', 'short_video', 'video_script')).height).toBe(1920);
  });
});
