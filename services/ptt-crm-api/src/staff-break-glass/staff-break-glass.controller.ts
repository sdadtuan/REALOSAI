import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { StaffUser } from '../staff-auth/staff-jwt.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffBreakGlassApproveGuard } from './guards/staff-break-glass.guard';
import { StaffBreakGlassService } from './staff-break-glass.service';
import type { ApproveBreakGlassBody, RequestBreakGlassBody } from './staff-break-glass.types';

@Controller('api/v1/staff/break-glass')
export class StaffBreakGlassController {
  constructor(private readonly breakGlass: StaffBreakGlassService) {}

  @Post('request')
  @UseGuards(StaffOrInternalKeyGuard)
  request(@Body() body: RequestBreakGlassBody, @StaffUser() staffUser?: StaffJwtPayload) {
    if (!staffUser) throw new Error('Unauthorized');
    return this.breakGlass.request(staffUser.sub, body, staffUser.email);
  }

  @Post(':id/approve')
  @UseGuards(StaffOrInternalKeyGuard, StaffBreakGlassApproveGuard)
  approve(
    @Param('id') id: string,
    @Body() body: ApproveBreakGlassBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    const actor = staffUser?.email ?? 'internal';
    return this.breakGlass.approve(id, body, actor);
  }

  @Get('active')
  @UseGuards(StaffOrInternalKeyGuard, StaffBreakGlassApproveGuard)
  listActive() {
    return this.breakGlass.listActive();
  }

  @Post('revoke-expired')
  @UseGuards(StaffOrInternalKeyGuard)
  revokeExpired() {
    return this.breakGlass.revokeExpired();
  }
}
