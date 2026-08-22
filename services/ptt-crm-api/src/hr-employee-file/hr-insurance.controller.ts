import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import {
  StaffHrInsuranceEditGuard,
  StaffHrInsuranceViewGuard,
} from './guards/staff-hr-insurance.guard';
import { HrInsuranceService } from './hr-insurance.service';
import type {
  CreateHrInsurancePeriodBody,
  PatchHrInsurancePeriodBody,
  PutHrStaffInsuranceBody,
} from './hr-insurance.types';

@Controller('api/v1/hr/staff/:id/insurance')
@UseGuards(StaffOrInternalKeyGuard, HrEmployeeFileEnabledGuard)
export class HrInsuranceController {
  constructor(private readonly insurance: HrInsuranceService) {}

  @Get()
  @UseGuards(StaffHrInsuranceViewGuard)
  get(@Req() req: Request & { staffUser?: StaffJwtPayload }, @Param('id') id: string) {
    return this.insurance.getInsurance(req.staffUser, Number(id));
  }

  @Put()
  @UseGuards(StaffHrInsuranceEditGuard)
  put(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Body() body: PutHrStaffInsuranceBody,
  ) {
    return this.insurance.putInsurance(req.staffUser, Number(id), body);
  }

  @Post('periods')
  @UseGuards(StaffHrInsuranceEditGuard)
  createPeriod(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Body() body: CreateHrInsurancePeriodBody,
  ) {
    return this.insurance.createPeriod(req.staffUser, Number(id), body);
  }

  @Patch('periods/:periodId')
  @UseGuards(StaffHrInsuranceEditGuard)
  patchPeriod(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Param('periodId') periodId: string,
    @Body() body: PatchHrInsurancePeriodBody,
  ) {
    return this.insurance.patchPeriod(req.staffUser, Number(id), Number(periodId), body);
  }
}
