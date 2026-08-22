import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffB2bProjectsViewGuard } from './guards/staff-b2b-projects.guard';
import { B2bSpeedService } from './b2b-speed.service';

@Controller('api/v1/b2b-speed')
@UseGuards(StaffOrInternalKeyGuard, StaffB2bProjectsViewGuard)
export class B2bSpeedController {
  constructor(private readonly speed: B2bSpeedService) {}

  @Get()
  report(
    @Query('project_id') projectId?: string,
    @Query('days') daysRaw?: string,
  ) {
    const days = daysRaw != null ? Number(daysRaw) : undefined;
    return this.speed.getSpeedReport({
      projectId: String(projectId ?? '').trim(),
      days: Number.isFinite(days) ? days : undefined,
    });
  }
}
