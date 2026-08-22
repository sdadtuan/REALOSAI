import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AccessReviewCampaignRepository } from '../access-review-campaign.repository';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';

@Injectable()
export class AccessReviewCertifyGuard implements CanActivate {
  constructor(
    private readonly staffAuth: StaffAuthService,
    private readonly repo: AccessReviewCampaignRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (this.staffAuth.hasCap(me.caps, 'crm_data_config', 'configure')) {
      return true;
    }

    const itemId =
      (req.params?.itemId as string | undefined) ??
      (req.body?.item_ids?.[0] as string | undefined);
    if (itemId && (await this.repo.isTeamLeadForItem(itemId, me.email))) {
      return true;
    }

    throw new ForbiddenException({ error: 'missing_certify_scope' });
  }
}
