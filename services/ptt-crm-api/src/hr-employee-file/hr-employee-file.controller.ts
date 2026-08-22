import { Body, Controller, Get, Param, Patch, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffHrEmployeeFileViewGuard,
  StaffHrEmployeeFileWriteGuard,
} from './guards/staff-hr-employee-file.guard';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import { HrEmployeeFileService } from './hr-employee-file.service';
import type { PatchHrStaffIdentityBody, PutHrStaffAddressesBody } from './hr-employee-file.types';

@Controller('api/v1/hr/staff')
@UseGuards(StaffOrInternalKeyGuard, HrEmployeeFileEnabledGuard)
export class HrEmployeeFileController {
  constructor(private readonly hrFile: HrEmployeeFileService) {}

  @Get(':id/profile')
  @UseGuards(StaffHrEmployeeFileViewGuard)
  getProfile(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
  ) {
    return this.hrFile.getProfile(req.staffUser, Number(id));
  }

  @Patch(':id/identity')
  @UseGuards(StaffHrEmployeeFileWriteGuard)
  patchIdentity(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Body() body: PatchHrStaffIdentityBody,
  ) {
    return this.hrFile.patchIdentity(req.staffUser, Number(id), body);
  }

  @Put(':id/addresses')
  @UseGuards(StaffHrEmployeeFileWriteGuard)
  putAddresses(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Body() body: PutHrStaffAddressesBody,
  ) {
    return this.hrFile.putAddresses(req.staffUser, Number(id), body);
  }
}
