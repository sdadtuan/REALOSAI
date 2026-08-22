import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import type { MktAiSectionCommentRow } from './marketing-ai-planner.types';

const VALID_SECTION_KEYS = new Set([
  'target_market',
  'market_message',
  'media_reach',
  'conversion_strategy',
  'segmentation_icp',
  'market_context',
  'personas_roles',
  'campaign_overview',
]);

@Injectable()
export class MarketingAiSectionCommentService {
  constructor(
    private readonly config: AppConfigService,
    private readonly repo: MarketingAiPlannerRepository,
  ) {}

  isEnabled(): boolean {
    return this.config.mktAiPlannerEnabled && this.config.mktAiSectionComments;
  }

  async list(lifecycleId: number, sectionKey?: string): Promise<MktAiSectionCommentRow[]> {
    if (!this.isEnabled()) return [];
    return this.repo.listSectionComments(lifecycleId, sectionKey);
  }

  async create(
    lifecycleId: number,
    input: { section_key: string; body: string; mention_email?: string | null },
    actorEmail: string,
  ): Promise<MktAiSectionCommentRow> {
    if (!this.isEnabled()) {
      throw new NotFoundException({ error: 'mkt_ai_section_comments_disabled' });
    }
    const sectionKey = String(input.section_key ?? '').trim();
    const body = String(input.body ?? '').trim();
    if (!sectionKey || !VALID_SECTION_KEYS.has(sectionKey)) {
      throw new BadRequestException({ error: 'invalid_section_key', section_key: sectionKey });
    }
    if (!body) {
      throw new BadRequestException({ error: 'comment_body_required' });
    }
    const mention = input.mention_email?.trim() || null;
    return this.repo.createSectionComment({
      lifecycle_id: lifecycleId,
      section_key: sectionKey,
      author_email: actorEmail,
      body,
      mention_email: mention,
    });
  }
}
