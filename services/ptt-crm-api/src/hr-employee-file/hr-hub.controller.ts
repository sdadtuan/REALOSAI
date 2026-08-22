import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import { StaffHrEmployeeFileViewGuard } from './guards/staff-hr-employee-file.guard';
import { HrStaffP5Service } from './hr-staff-p5.service';

@Controller('api/v1/hr/hub')
@UseGuards(StaffOrInternalKeyGuard, HrEmployeeFileEnabledGuard)
export class HrHubController {
  constructor(private readonly p5: HrStaffP5Service) {}

  @Get('expiry-summary')
  @UseGuards(StaffHrEmployeeFileViewGuard)
  expirySummary(@Req() req: Request & { staffUser?: StaffJwtPayload }) {
    return this.p5.hubExpirySummary(req.staffUser);
  }
}
