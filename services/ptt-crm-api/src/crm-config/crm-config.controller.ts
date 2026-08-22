import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { CrmConfigService } from './crm-config.service';
import type {
  CreateCustomFieldBody,
  CreateLeadLookupBody,
  CreatePipelineStageBody,
  PatchPipelineStageBody,
  UpdateCustomFieldBody,
  UpdateLeadLookupBody,
  UpdatePipelineStagesBody,
} from './crm-config.types';
import {
  StaffCrmConfigConfigureGuard,
  StaffCrmConfigViewGuard,
} from './guards/staff-crm-config.guard';

@Controller('api/crm/config')
export class CrmConfigController {
  constructor(private readonly crmConfig: CrmConfigService) {}

  @Get('custom-fields')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigViewGuard)
  listCustomFields(@Query('entity_type') entityType?: string) {
    return this.crmConfig.listCustomFields(entityType);
  }

  @Get('custom-fields/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigViewGuard)
  getCustomField(@Param('id') id: string) {
    return this.crmConfig.getCustomField(Number(id));
  }

  @Post('custom-fields')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  createCustomField(@Body() body: CreateCustomFieldBody) {
    return this.crmConfig.createCustomField(body);
  }

  @Patch('custom-fields/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  updateCustomField(@Param('id') id: string, @Body() body: UpdateCustomFieldBody) {
    return this.crmConfig.updateCustomField(Number(id), body);
  }

  @Delete('custom-fields/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  deleteCustomField(@Param('id') id: string) {
    return this.crmConfig.deleteCustomField(Number(id));
  }

  @Get('pipeline/sales/stages')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigViewGuard)
  listSalesPipelineStages(@Query('include_inactive') includeInactive?: string) {
    const include =
      includeInactive === '1' || includeInactive === 'true' || includeInactive === 'yes';
    return this.crmConfig.listSalesPipelineStages(include);
  }

  @Post('pipeline/sales/stages')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  createSalesPipelineStage(@Body() body: CreatePipelineStageBody) {
    return this.crmConfig.createSalesPipelineStage(body);
  }

  @Patch('pipeline/sales/stages/:stageKey')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  patchSalesPipelineStage(
    @Param('stageKey') stageKey: string,
    @Body() body: PatchPipelineStageBody,
  ) {
    return this.crmConfig.patchSalesPipelineStage(stageKey, body);
  }

  @Delete('pipeline/sales/stages/:stageKey')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  deleteSalesPipelineStage(@Param('stageKey') stageKey: string) {
    return this.crmConfig.deleteSalesPipelineStage(stageKey);
  }

  @Put('pipeline/sales/stages')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  replaceSalesPipelineStages(@Body() body: UpdatePipelineStagesBody) {
    return this.crmConfig.replaceSalesPipelineStages(body);
  }

  @Get('lead-lookups')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigViewGuard)
  listLeadLookups(@Query('kind') kind?: string, @Query('active_only') activeOnly?: string) {
    const normalizedKind = kind === 'source' || kind === 'channel' ? kind : undefined;
    return this.crmConfig.listLeadLookups(normalizedKind, activeOnly === '1' || activeOnly === 'true');
  }

  @Post('lead-lookups')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  createLeadLookup(@Body() body: CreateLeadLookupBody) {
    return this.crmConfig.createLeadLookup(body);
  }

  @Patch('lead-lookups/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  updateLeadLookup(@Param('id') id: string, @Body() body: UpdateLeadLookupBody) {
    return this.crmConfig.updateLeadLookup(Number(id), body);
  }

  @Delete('lead-lookups/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffCrmConfigConfigureGuard)
  deleteLeadLookup(@Param('id') id: string) {
    return this.crmConfig.deleteLeadLookup(Number(id));
  }
}
