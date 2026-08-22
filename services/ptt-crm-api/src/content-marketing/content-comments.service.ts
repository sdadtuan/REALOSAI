import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import type { CmktCommentRow } from './content-marketing.types';

@Injectable()
export class ContentCommentsService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
  ) {}

  async listComments(lifecycleId: number, itemId: number): Promise<{ comments: CmktCommentRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    const comments = await this.repo.listItemComments(itemId);
    return { comments };
  }

  async addComment(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<{ comment: CmktCommentRow }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }

    const text = String(body.body ?? '').trim();
    if (text.length < 1) {
      throw new BadRequestException({ error: 'comment_required', message: 'Comment không được trống.' });
    }

    const visibility = String(body.visibility ?? 'internal').trim();
    if (visibility !== 'internal' && visibility !== 'client') {
      throw new BadRequestException({ error: 'invalid_visibility', visibility });
    }

    const comment = await this.repo.insertItemCommentReturning({
      item_id: itemId,
      author_id: actorEmail,
      body: text,
      visibility,
    });
    return { comment };
  }
}
