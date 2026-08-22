import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import {
  StaffHrDependentEditGuard,
  StaffHrDependentViewGuard,
} from './guards/staff-hr-dependent.guard';
import { HrStaffP5Service } from './hr-staff-p5.service';
import type { CreateHrStaffDependentBody, PatchHrStaffDependentBody } from './hr-staff-p5.types';

@Controller('api/v1/hr/staff/:id/dependents')
@UseGuards(StaffOrInternalKeyGuard, HrEmployeeFileEnabledGuard)
export class HrDependentController {
  constructor(private readonly p5: HrStaffP5Service) {}

  @Get()
  @UseGuards(StaffHrDependentViewGuard)
  list(@Req() req: Request & { staffUser?: StaffJwtPayload }, @Param('id') id: string) {
    return this.p5.listDependents(req.staffUser, Number(id));
  }

  @Post()
  @UseGuards(StaffHrDependentEditGuard)
  create(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Body() body: CreateHrStaffDependentBody,
  ) {
    return this.p5.createDependent(req.staffUser, Number(id), body);
  }

  @Patch(':depId')
  @UseGuards(StaffHrDependentEditGuard)
  patch(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Param('depId') depId: string,
    @Body() body: PatchHrStaffDependentBody,
  ) {
    return this.p5.patchDependent(req.staffUser, Number(id), Number(depId), body);
  }

  @Delete(':depId')
  @UseGuards(StaffHrDependentEditGuard)
  remove(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Param('depId') depId: string,
  ) {
    return this.p5.deleteDependent(req.staffUser, Number(id), Number(depId));
  }
}
