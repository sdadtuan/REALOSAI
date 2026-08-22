import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Body,
  Optional,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { isBdsAgencyEnabled } from '../bds.flags';
import { BdsAgencyService } from '../agencies/bds-agency.service';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsInventoryService } from './bds-inventory.service';

@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard)
export class BdsInventoryController {
  constructor(
    private readonly inventory: BdsInventoryService,
    @Optional() private readonly agencies?: BdsAgencyService | null,
  ) {}

  @Get('projects/:id/units')
  async listUnits(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-bds-tenant') tenantId?: string,
    @Headers('x-bds-agency') agencyId?: string,
  ) {
    const result = await this.inventory.listUnits(id, tenantId);
    const agency = String(agencyId ?? '').trim();
    if (agency && isBdsAgencyEnabled() && this.agencies) {
      const basket = await this.agencies.listBasket(agency, id, tenantId);
      const allowed = new Set(basket.map((b) => b.product_id));
      return {
        units: result.units.filter(
          (u) => allowed.has(Number(u.id)) && String(u.pool ?? '') !== 'inhouse',
        ),
      };
    }
    return result;
  }

  @Get('units/:id')
  async getUnit(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-bds-tenant') tenantId?: string,
    @Headers('x-bds-agency') agencyId?: string,
  ) {
    const row = await this.inventory.getOrThrow(id, tenantId);
    const agency = String(agencyId ?? '').trim();
    if (agency && isBdsAgencyEnabled() && this.agencies) {
      await this.agencies.assertUnitVisible(agency, id, tenantId);
    }
    return row;
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
