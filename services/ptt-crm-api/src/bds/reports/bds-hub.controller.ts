import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsUiGuard } from '../guards/bds-ui.guard';
import { BdsHubService } from './bds-hub.service';

@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsUiGuard)
export class BdsHubController {
  constructor(private readonly hubService: BdsHubService) {}

  @Get('hub')
  hub(@Headers('x-bds-tenant') tenantId?: string) {
    return this.hubService.getHub(String(tenantId ?? ''));
  }

  @Get('leaderboard')
  leaderboard(
    @Query('period') period: string,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.hubService.listLeaderboard(period, String(tenantId ?? ''));
  }
}
