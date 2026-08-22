import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import {
  StaffVdGateApproveGuard,
  StaffVdProjectEditGuard,
  StaffVdProjectViewGuard,
} from '../guards/staff-vd-project.guard';
import { VdGateService } from './vd-gate.service';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

const HTTP_400 = new Set([
  'cmkt_cinematic_disabled',
  'vd_tables_missing',
  'invalid_body',
  'stage_guard',
  'gate_checklist_failed',
  'gate3_incomplete',
  'gate4_blocked',
  'override_reason',
  'shotlist_immutable',
]);

function actorEmail(req: StaffReq): string {
  if (req.staffAuthVia === 'internal') return 'internal';
  return req.staffUser?.email ?? 'unknown';
}

function mapKnownError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg === 'vd_project_not_found') {
    throw new NotFoundException({ error: msg, message: msg });
  }
  if (HTTP_400.has(msg)) {
    throw new BadRequestException({ error: msg, message: msg });
  }
  throw err;
}

@Controller('api/v1/vd/projects')
@UseGuards(StaffOrInternalKeyGuard)
export class VdGateController {
  constructor(private readonly gates: VdGateService) {}

  @Get(':id/gates/:n')
  @UseGuards(StaffVdProjectViewGuard)
  async getGate(@Param('id', ParseIntPipe) id: number, @Param('n', ParseIntPipe) gateNo: number) {
    try {
      return await this.gates.getGate(id, gateNo);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post(':id/gates/:n/approve')
  @HttpCode(200)
  @UseGuards(StaffVdGateApproveGuard)
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Param('n', ParseIntPipe) gateNo: number,
    @Body() body: Record<string, unknown>,
    @Req() req: StaffReq,
  ) {
    try {
      return await this.gates.approve(id, gateNo, body ?? {}, actorEmail(req));
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post(':id/gates/:n/reject')
  @HttpCode(200)
  @UseGuards(StaffVdGateApproveGuard)
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Param('n', ParseIntPipe) gateNo: number,
    @Body() body: Record<string, unknown>,
    @Req() req: StaffReq,
  ) {
    try {
      return await this.gates.reject(id, gateNo, body ?? {}, actorEmail(req));
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post(':id/shotlist/ready')
  @HttpCode(200)
  @UseGuards(StaffVdProjectEditGuard)
  async shotlistReady(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.gates.markShotlistReady(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post(':id/stage')
  @HttpCode(200)
  @UseGuards(StaffVdProjectEditGuard)
  async advanceStage(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    try {
      const stage = typeof body?.stage === 'string' ? body.stage.trim() : '';
      if (!stage) throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
      return await this.gates.advanceStage(id, stage);
    } catch (err) {
      mapKnownError(err);
    }
  }
}
