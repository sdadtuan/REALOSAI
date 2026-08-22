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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import type { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsBuyerGuard } from '../guards/bds-buyer.guard';
import { BdsBuyerLeadService } from './bds-buyer-lead.service';
import { BdsBuyerMatchingService } from './bds-buyer-matching.service';
import { BdsBuyerVisitService } from './bds-buyer-visit.service';
import type { CreateBuyerLeadBody, CreateVisitBody, QualifyBuyerLeadBody } from './bds-buyer.types';

type StaffReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/v1/bds/leads')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsBuyerGuard)
export class BdsBuyerLeadController {
  constructor(
    private readonly leads: BdsBuyerLeadService,
    private readonly matching: BdsBuyerMatchingService,
    private readonly visits: BdsBuyerVisitService,
  ) {}

  @Get()
  list(
    @Query('project_id', ParseIntPipe) projectId: number,
    @Headers('x-bds-tenant') tenantId?: string,
    @Headers('x-bds-agency') agencyId?: string,
    @Req() req?: StaffReq,
  ) {
    return this.leads.list(projectId, String(tenantId ?? ''), {
      agencyId,
      viewAll: req?.staffAuthVia === 'internal',
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateBuyerLeadBody, @Headers('x-bds-tenant') tenantId?: string) {
    return this.leads.create(body, String(tenantId ?? ''));
  }

  @Post(':id/qualify')
  @HttpCode(HttpStatus.OK)
  qualify(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: QualifyBuyerLeadBody,
    @Headers('x-bds-tenant') tenantId?: string,
    @Headers('x-bds-agency') agencyId?: string,
    @Req() req?: StaffReq,
  ) {
    return this.leads.qualify(id, body, String(tenantId ?? ''), {
      agencyId,
      viewAll: req?.staffAuthVia === 'internal',
    });
  }

  @Post(':id/touch')
  @HttpCode(HttpStatus.OK)
  touch(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-bds-tenant') tenantId?: string,
    @Headers('x-bds-agency') agencyId?: string,
    @Req() req?: StaffReq,
  ) {
    return this.leads.recordTouch(id, String(tenantId ?? ''), {
      agencyId,
      viewAll: req?.staffAuthVia === 'internal',
    });
  }

  @Get(':id/matches')
  matches(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-bds-tenant') tenantId?: string,
    @Headers('x-bds-agency') agencyId?: string,
  ) {
    return this.matching.match(id, String(tenantId ?? ''), { agencyId });
  }

  @Post(':id/visits')
  @HttpCode(HttpStatus.CREATED)
  createVisit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateVisitBody,
    @Headers('x-bds-tenant') tenantId?: string,
    @Headers('x-bds-agency') agencyId?: string,
    @Req() req?: StaffReq,
  ) {
    return this.visits.createVisit(id, body, String(tenantId ?? ''), {
      agencyId,
      viewAll: req?.staffAuthVia === 'internal',
    });
  }
}
