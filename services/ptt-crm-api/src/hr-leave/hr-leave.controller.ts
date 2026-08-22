import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffHrLeaveApproveGuard,
  StaffHrLeaveRequestGuard,
} from './guards/staff-hr-leave.guard';
import { HrLeaveService } from './hr-leave.service';
import type { ApproveLeaveRequestBody, CreateLeaveRequestBody } from './hr-leave.types';

@Controller('api/v1/hr/leave')
@UseGuards(StaffOrInternalKeyGuard)
export class HrLeaveController {
  constructor(private readonly leave: HrLeaveService) {}

  @Get('requests')
  @UseGuards(StaffHrLeaveRequestGuard)
  list(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Query('all') all?: string,
  ) {
    return this.leave.listRequests(req.staffUser, all === '1' || all === 'true');
  }

  @Post('requests')
  @UseGuards(StaffHrLeaveRequestGuard)
  create(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Body() body: CreateLeaveRequestBody,
  ) {
    return this.leave.createRequest(req.staffUser, body);
  }

  @Patch('requests/:id/approve')
  @UseGuards(StaffHrLeaveApproveGuard)
  approve(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Param('id') id: string,
    @Body() body: ApproveLeaveRequestBody,
  ) {
    return this.leave.approveRequest(req.staffUser, id, body);
  }
}
