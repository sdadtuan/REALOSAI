import { Controller, Get, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsUiGuard } from '../guards/bds-ui.guard';
import { BdsOrgG0Service } from './bds-org-g0.service';

@Controller('api/v1/bds/org')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsUiGuard)
export class BdsOrgController {
  constructor(private readonly g0Service: BdsOrgG0Service) {}

  @Get('g0')
  g0() {
    return this.g0Service.getG0Status();
  }
}
