import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { LeadsFunnelPgRepository } from '../leads-funnel-pg.repository';

/** Block AM writes while lead is in GDKD review queue (FR-CRM-04). */
@Injectable()
export class LeadNotInReviewQueueGuard implements CanActivate {
  constructor(
    private readonly config: AppConfigService,
    private readonly pgRepo: LeadsFunnelPgRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.config.crmLeadsFunnelNest) return true;
    const req = context.switchToHttp().getRequest<
      Request & { staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    const leadId = Number(req.params?.id);
    if (!Number.isFinite(leadId)) return true;

    const inReview = await this.pgRepo.isLeadInReviewQueue(leadId);

    if (inReview) {
      throw new ForbiddenException({
        error: 'review_queue_active',
        message: 'Lead đang ở danh mục Phải tra soát — chỉ GDKD được xử lý.',
      });
    }
    return true;
  }
}
