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
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsPolicyGuard } from '../guards/bds-policy.guard';
import {
  BdsPolicyService,
  type ActivateBody,
  type AddPriceListItemBody,
  type ArchiveBody,
  type CreatePolicyBody,
  type CreatePriceListBody,
  type QuoteBody,
} from './bds-policy.service';

@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsPolicyGuard)
export class BdsPolicyController {
  constructor(private readonly policies: BdsPolicyService) {}

  @Get('projects/:id/policies')
  listPolicies(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.policies.listByProject(id, tenantId);
  }

  @Post('projects/:id/policies')
  createPolicy(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreatePolicyBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.policies.create(id, body, tenantId);
  }

  @Get('policies/:id')
  getPolicy(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.policies.get(id, tenantId);
  }

  @Post('policies/:id/update')
  @HttpCode(HttpStatus.OK)
  updatePolicy(
    @Param('id') id: string,
    @Body() body: CreatePolicyBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.policies.updateDraft(id, body, tenantId);
  }

  @Post('policies/:id/activate')
  @HttpCode(HttpStatus.OK)
  activate(
    @Param('id') id: string,
    @Body() body: ActivateBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.policies.activate(
      id,
      {
        phase_id: String(body.phase_id ?? ''),
        price_list_id: Number(body.price_list_id),
        actor_role: String(body.actor_role ?? ''),
        activated_by: body.activated_by,
      },
      tenantId,
    );
  }

  @Post('policies/:id/archive')
  @HttpCode(HttpStatus.OK)
  archive(
    @Param('id') id: string,
    @Body() body: ArchiveBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.policies.archive(
      id,
      { actor_role: String(body.actor_role ?? '') },
      tenantId,
    );
  }

  @Post('policies/:id/quote')
  @HttpCode(HttpStatus.OK)
  quote(
    @Param('id') id: string,
    @Body() body: QuoteBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.policies.quote(id, body, tenantId);
  }

  @Get('projects/:id/price-lists')
  listPriceLists(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.policies.listPriceLists(id, tenantId);
  }

  @Post('projects/:id/price-lists')
  createPriceList(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreatePriceListBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.policies.createPriceList(id, body, tenantId);
  }

  @Post('price-lists/:id/items')
  addPriceListItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AddPriceListItemBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.policies.addPriceListItem(id, body, tenantId);
  }
}
