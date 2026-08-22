import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import {
  StaffVdProjectCreateGuard,
  StaffVdProjectViewGuard,
} from '../guards/staff-vd-project.guard';
import { VdProjectHttpService } from './vd-project-http.service';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

function actorEmail(req: StaffReq): string {
  if (req.staffAuthVia === 'internal') return 'internal';
  return req.staffUser?.email ?? 'unknown';
}

@Controller('api/v1/vd/projects')
@UseGuards(StaffOrInternalKeyGuard)
export class VdProjectController {
  constructor(private readonly http: VdProjectHttpService) {}

  @Post()
  @HttpCode(201)
  @UseGuards(StaffVdProjectCreateGuard)
  create(@Body() body: Record<string, unknown>, @Req() req: StaffReq) {
    return this.http.create(body, actorEmail(req));
  }

  @Get()
  @UseGuards(StaffVdProjectViewGuard)
  list(@Query('lifecycle_id', ParseIntPipe) lifecycleId: number) {
    return this.http.list(lifecycleId);
  }

  @Get(':id')
  @UseGuards(StaffVdProjectViewGuard)
  get(@Param('id', ParseIntPipe) id: number) {
    return this.http.get(id);
  }
}
