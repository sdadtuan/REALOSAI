import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class LeadMeetingPrepEnabledGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.config.leadMeetingPrepEnabled) {
      throw new NotFoundException({
        error: 'lead_meeting_prep_disabled',
        message: 'Lead Meeting Prep chưa bật (PTT_LEAD_MEETING_PREP_ENABLED=0)',
      });
    }
    return true;
  }
}
