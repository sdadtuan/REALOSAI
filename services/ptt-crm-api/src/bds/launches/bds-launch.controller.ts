import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsLaunchGuard } from '../guards/bds-launch.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsLaunchService } from './bds-launch.service';

@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsLaunchGuard)
export class BdsLaunchController {
  constructor(private readonly launches: BdsLaunchService) {}

  @Post('projects/:id/launches')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      phase_id?: string;
      hold_ttl_seconds?: number;
      starts_at?: string;
      ends_at?: string;
      price_list_id?: number;
    },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.launches.create(
      {
        project_id: id,
        phase_id: body.phase_id,
        hold_ttl_seconds: body.hold_ttl_seconds,
        starts_at: body.starts_at,
        ends_at: body.ends_at,
        price_list_id: body.price_list_id,
      },
      String(tenantId ?? ''),
    );
  }

  @Get('launches')
  list(
    @Headers('x-bds-tenant') tenantId: string,
    @Query('project_id', new ParseIntPipe({ optional: true })) projectId?: number,
  ) {
    return this.launches.list(String(tenantId ?? ''), projectId);
  }

  @Get('launches/:id')
  get(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.launches.get(id, String(tenantId ?? ''));
  }

  @Post('launches/:id/open')
  @HttpCode(HttpStatus.OK)
  open(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.launches.open(id, String(tenantId ?? ''));
  }

  @Post('launches/:id/close')
  @HttpCode(HttpStatus.OK)
  close(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.launches.close(id, String(tenantId ?? ''));
  }

  @Get('launches/:id/war-room')
  warRoom(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.launches.warRoom(id, String(tenantId ?? ''));
  }
}
