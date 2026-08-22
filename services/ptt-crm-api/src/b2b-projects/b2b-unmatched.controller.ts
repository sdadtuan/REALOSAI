import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffB2bProjectsManageGuard } from './guards/staff-b2b-projects.guard';
import { B2bUnmatchedService } from './b2b-unmatched.service';

@Controller('api/v1/b2b-unmatched')
@UseGuards(StaffOrInternalKeyGuard, StaffB2bProjectsManageGuard)
export class B2bUnmatchedController {
  constructor(private readonly unmatched: B2bUnmatchedService) {}

  @Get()
  list(
    @Query('limit') limitRaw?: string,
    @Query('since') since?: string,
  ) {
    const limit = limitRaw != null ? Number(limitRaw) : undefined;
    return this.unmatched.list({
      limit: Number.isFinite(limit) ? limit : undefined,
      since: since?.trim() || undefined,
    });
  }

  @Post(':id/map')
  map(
    @Param('id') id: string,
    @Body() body: { project_id?: string; page_id?: string },
  ) {
    if (!body.project_id?.trim()) {
      throw new HttpException({ error: 'project_id_required' }, HttpStatus.BAD_REQUEST);
    }
    return this.unmatched.mapToProject({
      id,
      projectId: body.project_id.trim(),
      pageId: body.page_id?.trim() || undefined,
    });
  }
}
