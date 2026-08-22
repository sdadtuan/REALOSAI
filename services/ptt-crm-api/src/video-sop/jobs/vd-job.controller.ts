import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import {
  StaffVdProjectCreateGuard,
  StaffVdProjectViewGuard,
} from '../guards/staff-vd-project.guard';
import { VdJobHttpService } from './vd-job-http.service';

@Controller('api/v1/vd')
@UseGuards(StaffOrInternalKeyGuard)
export class VdJobController {
  constructor(private readonly http: VdJobHttpService) {}

  @Post('projects/:id/jobs')
  @HttpCode(201)
  @UseGuards(StaffVdProjectCreateGuard)
  create(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.http.enqueue(id, body, idempotencyKey);
  }

  @Get('projects/:id/jobs')
  @UseGuards(StaffVdProjectViewGuard)
  list(@Param('id', ParseIntPipe) id: number) {
    return this.http.list(id);
  }

  @Get('jobs/:id')
  @UseGuards(StaffVdProjectViewGuard)
  get(@Param('id', ParseIntPipe) id: number) {
    return this.http.get(id);
  }
}
