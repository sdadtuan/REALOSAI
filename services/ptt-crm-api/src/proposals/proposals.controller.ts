import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffProposalsViewGuard,
  StaffProposalsWriteGuard,
} from './guards/staff-proposals.guard';
import { ProposalsService } from './proposals.service';
import { CreateProposalBody, PatchProposalStatusBody, PutQuoteLinesBody } from './proposals.types';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/crm/proposals')
@UseGuards(StaffOrInternalKeyGuard, StaffProposalsViewGuard)
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get('quote-catalog')
  getQuoteCatalog(@Query('service_slug') serviceSlug?: string) {
    return this.proposals.getCatalogForQuote(serviceSlug);
  }

  @Get()
  list(@Query('customer_id') customerId?: string, @Query('lead_id') leadId?: string) {
    return this.proposals.list(customerId, leadId);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.proposals.detail(id);
  }

  @Get(':id/lines')
  getLines(@Param('id', ParseIntPipe) id: number) {
    return this.proposals.getLines(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffProposalsWriteGuard)
  create(@Body() body: CreateProposalBody) {
    return this.proposals.create(body);
  }

  @Put(':id/lines')
  @UseGuards(StaffProposalsWriteGuard)
  putLines(@Param('id', ParseIntPipe) id: number, @Body() body: PutQuoteLinesBody) {
    return this.proposals.putLines(id, body);
  }

  @Patch(':id/status')
  @UseGuards(StaffProposalsWriteGuard)
  patchStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchProposalStatusBody,
    @Req() req: StaffReq,
  ) {
    const actor = req.staffUser?.email ?? 'staff';
    return this.proposals.patchStatus(id, body, actor);
  }

  @Post(':id/export')
  @UseGuards(StaffProposalsWriteGuard)
  @Header('Cache-Control', 'no-store')
  exportQuote(
    @Param('id', ParseIntPipe) id: number,
    @Query('format') format?: 'pdf' | 'docx',
  ) {
    return this.proposals.exportQuote(id, format ?? 'pdf');
  }

  @Post(':id/generate')
  @UseGuards(StaffProposalsWriteGuard)
  generate(@Param('id', ParseIntPipe) id: number) {
    return this.proposals.generate(id);
  }

  @Delete(':id')
  @UseGuards(StaffProposalsWriteGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.proposals.remove(id);
  }
}
