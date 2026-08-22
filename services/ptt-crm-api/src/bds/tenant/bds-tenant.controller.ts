import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsTenantService } from './bds-tenant.service';
import type { CreateBdsTenantBody } from './bds-tenant.types';

@Controller('api/v1/bds/tenants')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard)
export class BdsTenantController {
  constructor(private readonly tenants: BdsTenantService) {}

  @Post()
  create(@Body() body: CreateBdsTenantBody) {
    return this.tenants.create(body);
  }

  @Get('me')
  me(@Headers('x-bds-tenant') tenantId: string) {
    return this.tenants.getMe(tenantId);
  }

  @Post(':id/activate')
  activate(
    @Param('id') id: string,
    @Body() body: { assigned_position_codes: string[] },
  ) {
    return this.tenants.activate(id, body.assigned_position_codes ?? []);
  }
}
