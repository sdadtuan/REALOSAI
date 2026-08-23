import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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

  @Get('hub/export')
  async exportHdqt(
    @Query('kind') kind: string,
    @Headers('x-bds-tenant') tenantId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (String(kind ?? '') !== 'hdqt') {
      throw new BadRequestException({ error: 'kind' });
    }
    const csv = await this.hubService.exportHdqtCsv(String(tenantId ?? ''));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bds-hdqt.csv"');
    return csv;
  }

  @Get('leaderboard')
  leaderboard(
    @Query('period') period: string,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.hubService.listLeaderboard(period, String(tenantId ?? ''));
  }
}
