import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import {
  StaffHrEmployeeFileViewGuard,
  StaffHrEmployeeFileWriteGuard,
} from './guards/staff-hr-employee-file.guard';
import { HrStaffP5Service } from './hr-staff-p5.service';
import type { PatchHrStaffLifecycleBody } from './hr-staff-p5.types';

@Controller('api/v1/hr/staff/:id/lifecycle')
@UseGuards(StaffOrInternalKeyGuard, HrEmployeeFileEnabledGuard)
export class HrLifecycleController {
  constructor(private readonly p5: HrStaffP5Service) {}

  @Get()
  @UseGuards(StaffHrEmployeeFileViewGuard)
  get(@Req() req: Request & { staffUser?: StaffJwtPayload }, @Param('id') id: string) {
    return this.p5.getLifecycle(req.staffUser, Number(id));
  }

  @Patch()
  @UseGuards(StaffHrEmployeeFileWriteGuard)
  patch(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Body() body: PatchHrStaffLifecycleBody,
  ) {
    return this.p5.patchLifecycle(req.staffUser, Number(id), body);
  }
}
