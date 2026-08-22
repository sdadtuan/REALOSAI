import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { PlaybooksService } from './playbooks.service';
import { CreatePlaybookBody, CreatePlaybookChunkBody } from './playbooks.types';
import {
  StaffPlaybooksConfigureGuard,
  StaffPlaybooksViewGuard,
} from './guards/staff-playbooks.guard';

@Controller('api/v1/ai/playbooks')
@UseGuards(StaffOrInternalKeyGuard)
export class PlaybooksController {
  constructor(private readonly playbooks: PlaybooksService) {}

  @Get()
  @UseGuards(StaffPlaybooksViewGuard)
  list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.playbooks.list(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
      correlationId?.trim() || requestId?.trim(),
    );
  }

  @Post('rag/query')
  @UseGuards(StaffPlaybooksViewGuard)
  ragQuery(
    @Body() body: { query?: string; playbook_id?: string; limit?: number },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.playbooks.ragQuery(
      {
        query: body.query ?? '',
        playbook_id: body.playbook_id,
        limit: body.limit,
      },
      correlationId?.trim() || requestId?.trim(),
    );
  }

  @Get('ranked')
  @UseGuards(StaffPlaybooksViewGuard)
  listRanked(
    @Query('context') context?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.playbooks.listRanked(context, correlationId?.trim() || requestId?.trim());
  }

  @Get(':id')
  @UseGuards(StaffPlaybooksViewGuard)
  getById(
    @Param('id') id: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.playbooks.getById(id, correlationId?.trim() || requestId?.trim());
  }

  @Post()
  @UseGuards(StaffPlaybooksConfigureGuard)
  create(
    @Body() body: CreatePlaybookBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.playbooks.create(body, req.staffUser?.sub ?? null, correlationId?.trim() || requestId?.trim());
  }

  @Post(':id/chunks')
  @UseGuards(StaffPlaybooksConfigureGuard)
  addChunk(
    @Param('id') id: string,
    @Body() body: CreatePlaybookChunkBody,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.playbooks.addChunk(id, body, correlationId?.trim() || requestId?.trim());
  }
}
