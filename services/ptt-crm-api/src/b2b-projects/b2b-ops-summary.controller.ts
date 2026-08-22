import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffB2bProjectsViewGuard } from './guards/staff-b2b-projects.guard';
import { B2bOpsSummaryService } from './b2b-ops-summary.service';

@Controller('api/v1/b2b-ops-summary')
@UseGuards(StaffOrInternalKeyGuard, StaffB2bProjectsViewGuard)
export class B2bOpsSummaryController {
  constructor(private readonly summary: B2bOpsSummaryService) {}

  @Get()
  report(@Query('project_id') projectId?: string) {
    return this.summary.getSummary({ projectId: String(projectId ?? '').trim() || undefined });
  }
}
