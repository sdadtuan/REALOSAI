import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { CatalogService } from './catalog.service';
import {
  CreateAssignScopeBody,
  CreateCatalogIndustryBody,
  CreateCatalogServiceBody,
  PatchAssignScopeBody,
  PatchCatalogIndustryBody,
  PatchCatalogServiceBody,
} from './catalog.types';
import { StaffCatalogConfigureGuard, StaffCatalogViewGuard } from './guards/staff-catalog.guard';

@Controller('api/crm/catalog')
@UseGuards(StaffOrInternalKeyGuard, StaffCatalogViewGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  async getPublic() {
    return this.catalog.publicPayload();
  }

  @Get('services')
  async listServices() {
    const services = await this.catalog.listServices();
    return { services };
  }

  @Post('services')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffCatalogConfigureGuard)
  async createService(@Body() body: CreateCatalogServiceBody) {
    const service = await this.catalog.createService(body);
    return { service };
  }

  @Patch('services/:id')
  @UseGuards(StaffCatalogConfigureGuard)
  async patchService(@Param('id', ParseIntPipe) id: number, @Body() body: PatchCatalogServiceBody) {
    const service = await this.catalog.updateService(id, body);
    return { service };
  }

  @Get('industries')
  async listIndustries() {
    const industries = await this.catalog.listIndustries();
    return { industries };
  }

  @Post('industries')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffCatalogConfigureGuard)
  async createIndustry(@Body() body: CreateCatalogIndustryBody) {
    const industry = await this.catalog.createIndustry(body);
    return { industry };
  }

  @Patch('industries/:id')
  @UseGuards(StaffCatalogConfigureGuard)
  async patchIndustry(@Param('id', ParseIntPipe) id: number, @Body() body: PatchCatalogIndustryBody) {
    const industry = await this.catalog.updateIndustry(id, body);
    return { industry };
  }
}

@Controller('api/crm/assign-scopes')
@UseGuards(StaffOrInternalKeyGuard, StaffCatalogViewGuard)
export class AssignScopesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  async list() {
    return this.catalog.listAssignScopes();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffCatalogConfigureGuard)
  async create(@Body() body: CreateAssignScopeBody) {
    const scope = await this.catalog.createAssignScope(body);
    return { scope };
  }

  @Patch(':id')
  @UseGuards(StaffCatalogConfigureGuard)
  async patch(@Param('id', ParseIntPipe) id: number, @Body() body: PatchAssignScopeBody) {
    const scope = await this.catalog.updateAssignScope(id, body);
    return { scope };
  }

  @Delete(':id')
  @UseGuards(StaffCatalogConfigureGuard)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.catalog.deleteAssignScope(id);
    return { ok: true };
  }
}
