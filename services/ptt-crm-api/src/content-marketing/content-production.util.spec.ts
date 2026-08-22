import { BadRequestException } from '@nestjs/common';
import {
  assertProductionGateForPublish,
  defaultProductionPhase,
  itemNeedsProduction,
  mergeProductionJson,
} from './content-production.util';
import type { CmktItemRow } from './content-marketing.types';

const item = (patch: Partial<CmktItemRow>): CmktItemRow =>
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
    body_json: { markdown: 'slides' },
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
    ...patch,
  }) as CmktItemRow;

describe('content-production.util', () => {
  it('detects carousel needs production', () => {
    expect(itemNeedsProduction(item({}))).toBe(true);
    expect(defaultProductionPhase(item({}))).toBe('awaiting_design');
  });

  it('blocks publish when production not done', () => {
    expect(() => assertProductionGateForPublish(item({}))).toThrow(BadRequestException);
    expect(() =>
      assertProductionGateForPublish(item({ production_json: { phase: 'done' } })),
    ).not.toThrow();
  });

  it('skips production gate when carousel visual approved', () => {
    expect(() =>
      assertProductionGateForPublish(
        item({ format: 'carousel', production_json: { phase: 'awaiting_design' }, visual_status: 'approved' }),
      ),
    ).not.toThrow();
  });

  it('merges production patch', () => {
    const merged = mergeProductionJson({ phase: 'none' }, {
      phase: 'done',
      asset_urls: ['https://cdn/a.pdf'],
    });
    expect(merged.phase).toBe('done');
    expect(merged.asset_urls).toEqual(['https://cdn/a.pdf']);
  });
});
