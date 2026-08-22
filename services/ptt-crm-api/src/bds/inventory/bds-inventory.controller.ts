import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsInventoryService } from './bds-inventory.service';

@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard)
export class BdsInventoryController {
  constructor(private readonly inventory: BdsInventoryService) {}

  @Get('projects/:id/units')
  listUnits(@Param('id', ParseIntPipe) id: number, @Headers('x-bds-tenant') tenantId?: string) {
    return this.inventory.listUnits(id, tenantId);
  }

  @Get('projects/:id/stack')
  stack(@Param('id', ParseIntPipe) id: number, @Headers('x-bds-tenant') tenantId?: string) {
    return this.inventory.stack(id, tenantId);
  }

  @Post('projects/:id/units/import')
  @HttpCode(HttpStatus.OK)
  importCsv(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { csv?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.inventory.importCsv(id, String(body.csv ?? ''), tenantId);
  }

  @Post('units/:id/lock')
  @HttpCode(HttpStatus.OK)
  lock(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { row_version?: number; reason?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.inventory.lock(id, Number(body.row_version), String(body.reason ?? ''), tenantId);
  }

  @Post('units/:id/unlock')
  @HttpCode(HttpStatus.OK)
  unlock(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { row_version?: number },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.inventory.unlock(id, Number(body.row_version), tenantId);
  }

  @Patch('units/:id/pool')
  setPool(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { row_version?: number; pool?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.inventory.setPool(id, String(body.pool ?? ''), Number(body.row_version), tenantId);
  }
}
