import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsAgencyGuard } from '../guards/bds-agency.guard';
import {
  BdsAgencyService,
  type CreateAgencyBody,
  type CreateContractBody,
  type GrantUnitsBody,
  type OverrideTierBody,
  type QuoteBody,
} from './bds-agency.service';

@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsAgencyGuard)
export class BdsAgencyController {
  constructor(private readonly agencies: BdsAgencyService) {}

  @Post('agencies')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateAgencyBody, @Headers('x-bds-tenant') tenantId?: string) {
    return this.agencies.create(body, tenantId);
  }

  @Get('agencies')
  list(@Headers('x-bds-tenant') tenantId?: string) {
    return this.agencies.list(tenantId);
  }

  @Get('agencies/:id')
  get(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.agencies.get(id, tenantId);
  }

  @Post('agencies/:id/activate')
  @HttpCode(HttpStatus.OK)
  activate(
    @Param('id') id: string,
    @Body() body: { actor_role?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.agencies.activate(id, String(body.actor_role ?? ''), tenantId);
  }

  @Post('agencies/:id/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.agencies.suspend(id, tenantId);
  }

  @Post('agencies/:id/contracts')
  @HttpCode(HttpStatus.CREATED)
  createContract(
    @Param('id') id: string,
    @Body() body: CreateContractBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.agencies.createContract(
      id,
      {
        project_id: Number(body.project_id),
        max_concurrent_holds: body.max_concurrent_holds,
      },
      tenantId,
    );
  }

  @Post('agencies/:id/tier/override')
  @HttpCode(HttpStatus.OK)
  overrideTier(
    @Param('id') id: string,
    @Body() body: OverrideTierBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.agencies.overrideTier(id, body, tenantId);
  }

  @Post('agencies/:id/basket/units')
  @HttpCode(HttpStatus.OK)
  grantUnits(
    @Param('id') id: string,
    @Body() body: GrantUnitsBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.agencies.grantUnits(id, body, tenantId);
  }

  @Post('agencies/:id/basket/units/:productId/revoke')
  @HttpCode(HttpStatus.OK)
  revokeUnit(
    @Param('id') id: string,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() body: { reason?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.agencies.revokeUnit(id, productId, String(body.reason ?? ''), tenantId);
  }

  @Get('agencies/:id/basket')
  listBasket(
    @Param('id') id: string,
    @Headers('x-bds-tenant') tenantId?: string,
    @Headers('x-bds-project') projectId?: string,
  ) {
    const pid = String(projectId ?? '').trim();
    return this.agencies.listBasket(id, pid ? Number(pid) : undefined, tenantId);
  }

  @Get('me/basket')
  meBasket(
    @Headers('x-bds-agency') agencyId?: string,
    @Headers('x-bds-tenant') tenantId?: string,
    @Headers('x-bds-project') projectId?: string,
  ) {
    const agency = String(agencyId ?? '').trim();
    if (!agency) throw new BadRequestException({ error: 'agency_id' });
    const pid = String(projectId ?? '').trim();
    return this.agencies.listBasket(agency, pid ? Number(pid) : undefined, tenantId);
  }

  @Post('agencies/:id/quote')
  @HttpCode(HttpStatus.OK)
  quote(
    @Param('id') id: string,
    @Body() body: QuoteBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.agencies.quote(
      id,
      {
        policy_id: String(body.policy_id ?? ''),
        list_price_vnd: Number(body.list_price_vnd),
        discount_pct: Number(body.discount_pct),
        net_price_vnd: body.net_price_vnd,
        discount_approved: body.discount_approved,
      },
      tenantId,
    );
  }
}
