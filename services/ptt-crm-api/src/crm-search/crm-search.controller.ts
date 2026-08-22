import { Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { CrmSearchService } from './crm-search.service';
import { normalizeSearchEntityType } from './crm-search.types';
import { StaffCrmSearchConfigureGuard, StaffCrmSearchViewGuard } from './guards/staff-crm-search.guard';

@Controller('api/v1/search')
@UseGuards(StaffOrInternalKeyGuard)
export class CrmSearchController {
  constructor(private readonly search: CrmSearchService) {}

  @Get()
  @UseGuards(StaffCrmSearchViewGuard)
  query(
    @Query('q') q?: string,
    @Query('entity_type') entityType?: string,
    @Query('limit') limit?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.search.search(
      {
        q: q ?? '',
        entity_type: normalizeSearchEntityType(entityType) ?? undefined,
        limit: limit ? Number(limit) : undefined,
      },
      correlationId?.trim() || requestId?.trim(),
    );
  }

  @Get('health')
  @UseGuards(StaffCrmSearchViewGuard)
  health(
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.search.health(correlationId?.trim() || requestId?.trim());
  }

  @Post('reindex')
  @UseGuards(StaffCrmSearchConfigureGuard)
  reindex(
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.search.reindex(correlationId?.trim() || requestId?.trim());
  }
}
