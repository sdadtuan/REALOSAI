import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import {
  StaffHrContractEditGuard,
  StaffHrContractViewGuard,
} from './guards/staff-hr-contract.guard';
import { HrLaborContractService } from './hr-labor-contract.service';
import type {
  CreateHrLaborAppendixBody,
  CreateHrLaborContractBody,
  PatchHrLaborAppendixBody,
  PatchHrLaborContractBody,
} from './hr-labor-contract.types';

@Controller('api/v1/hr/staff/:id/contracts')
@UseGuards(StaffOrInternalKeyGuard, HrEmployeeFileEnabledGuard)
export class HrLaborContractController {
  constructor(private readonly contracts: HrLaborContractService) {}

  @Get()
  @UseGuards(StaffHrContractViewGuard)
  list(@Req() req: Request & { staffUser?: StaffJwtPayload }, @Param('id') id: string) {
    return this.contracts.listContracts(req.staffUser, Number(id));
  }

  @Post()
  @UseGuards(StaffHrContractEditGuard)
  create(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Body() body: CreateHrLaborContractBody,
  ) {
    return this.contracts.createContract(req.staffUser, Number(id), body);
  }

  @Patch(':contractId')
  @UseGuards(StaffHrContractEditGuard)
  patch(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Param('contractId') contractId: string,
    @Body() body: PatchHrLaborContractBody,
  ) {
    return this.contracts.patchContract(req.staffUser, Number(id), Number(contractId), body);
  }

  @Post(':contractId/appendices')
  @UseGuards(StaffHrContractEditGuard)
  createAppendix(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Param('contractId') contractId: string,
    @Body() body: CreateHrLaborAppendixBody,
  ) {
    return this.contracts.createAppendix(req.staffUser, Number(id), Number(contractId), body);
  }

  @Patch(':contractId/appendices/:appendixId')
  @UseGuards(StaffHrContractEditGuard)
  patchAppendix(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Param('contractId') contractId: string,
    @Param('appendixId') appendixId: string,
    @Body() body: PatchHrLaborAppendixBody,
  ) {
    return this.contracts.patchAppendix(
      req.staffUser,
      Number(id),
      Number(contractId),
      Number(appendixId),
      body,
    );
  }
}
