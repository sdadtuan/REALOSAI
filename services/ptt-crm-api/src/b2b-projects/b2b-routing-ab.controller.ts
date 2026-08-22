import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffB2bProjectsViewGuard } from './guards/staff-b2b-projects.guard';
import { B2bRoutingAbService } from './b2b-routing-ab.service';

@Controller('api/v1/b2b-routing-ab')
@UseGuards(StaffOrInternalKeyGuard, StaffB2bProjectsViewGuard)
export class B2bRoutingAbController {
  constructor(private readonly routingAb: B2bRoutingAbService) {}

  @Get()
  report(@Query('days') daysRaw?: string) {
    const days = daysRaw != null ? Number(daysRaw) : 30;
    return this.routingAb.getReport(Number.isFinite(days) ? days : 30);
  }
}
