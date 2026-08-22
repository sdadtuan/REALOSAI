import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import {
  StaffVdProjectEditGuard,
  StaffVdProjectViewGuard,
} from '../guards/staff-vd-project.guard';
import { VdBriefService } from './vd-brief.service';

const HTTP_400 = new Set([
  'brief_incomplete',
  'stage_guard',
  'cmkt_cinematic_disabled',
  'vd_tables_missing',
  'invalid_body',
]);

function mapKnownError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg === 'vd_project_not_found') {
    throw new NotFoundException({ error: msg, message: msg });
  }
  if (HTTP_400.has(msg)) {
    throw new BadRequestException({ error: msg, message: msg });
  }
  throw err;
}

@Controller('api/v1/vd/projects')
@UseGuards(StaffOrInternalKeyGuard)
export class VdBriefController {
  constructor(private readonly briefs: VdBriefService) {}

  @Get(':id/brief')
  @UseGuards(StaffVdProjectViewGuard)
  async get(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.briefs.get(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Put(':id/brief')
  @UseGuards(StaffVdProjectEditGuard)
  async save(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    try {
      return await this.briefs.save(id, body ?? {});
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post(':id/brief/ready')
  @HttpCode(200)
  @UseGuards(StaffVdProjectEditGuard)
  async markReady(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.briefs.markReady(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Get(':id/brief/insights')
  @UseGuards(StaffVdProjectViewGuard)
  async insights() {
    try {
      return await this.briefs.listInsights();
    } catch (err) {
      mapKnownError(err);
    }
  }
}
