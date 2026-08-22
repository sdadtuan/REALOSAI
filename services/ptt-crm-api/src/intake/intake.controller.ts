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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffIntakeViewGuard, StaffIntakeWriteGuard } from './guards/staff-intake.guard';
import { IntakeStaffActor } from './intake-b2b-visibility.service';
import { IntakeService } from './intake.service';
import { CreateIntakeSessionBody, PatchIntakeSessionBody } from './intake.types';

type IntakeRequest = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/crm/intake')
@UseGuards(StaffOrInternalKeyGuard, StaffIntakeViewGuard)
export class IntakeController {
  constructor(
    private readonly intake: IntakeService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async actorContext(req: IntakeRequest): Promise<IntakeStaffActor | null> {
    if (req.staffAuthVia === 'internal' || !req.staffUser) return null;
    const me = await this.staffAuth.me(req.staffUser);
    const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    if (staffId == null) return null;
    return { staffId, caps: me.caps, positionCode: me.position_code };
  }

  @Get('definitions')
  definitions() {
    return this.intake.getDefinitions();
  }

  @Get('definitions/:slug')
  definition(@Param('slug') slug: string) {
    return this.intake.getDefinition(slug);
  }

  @Get('stats')
  stats(@Query('am_id') amId?: string, @Query('by_am') byAm?: string) {
    const aid = amId ? Number(amId) : undefined;
    const byAmFlag = ['1', 'true', 'yes'].includes(String(byAm ?? '').toLowerCase());
    return this.intake.getStats(
      aid && Number.isFinite(aid) ? aid : undefined,
      byAmFlag,
    );
  }

  @Get('entry')
  async entry(
    @Req() req: IntakeRequest,
    @Query('lead_id') leadId?: string,
    @Query('mode') mode?: string,
    @Query('form') form?: string,
  ) {
    const lid = leadId ? Number(leadId) : undefined;
    return this.intake.resolveEntry(lid, mode, form, await this.actorContext(req));
  }

  @Get('sessions')
  async listSessions(
    @Req() req: IntakeRequest,
    @Query('lead_id') leadId?: string,
    @Query('lifecycle_id') lifecycleId?: string,
  ) {
    const lid = leadId ? Number(leadId) : undefined;
    const lcid = lifecycleId ? Number(lifecycleId) : undefined;
    return this.intake.listSessions(
      lid && Number.isFinite(lid) ? lid : undefined,
      lcid && Number.isFinite(lcid) ? lcid : undefined,
      await this.actorContext(req),
    );
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffIntakeWriteGuard)
  async createSession(@Req() req: IntakeRequest, @Body() body: CreateIntakeSessionBody) {
    return this.intake.createSession(body, await this.actorContext(req));
  }

  @Post('sessions/:id/reopen')
  @UseGuards(StaffIntakeWriteGuard)
  async reopenSession(@Req() req: IntakeRequest, @Param('id', ParseIntPipe) id: number) {
    return this.intake.reopenSession(id, await this.actorContext(req));
  }

  @Post('sessions/:id/ai-summary')
  @UseGuards(StaffIntakeWriteGuard)
  async aiSummary(@Req() req: IntakeRequest, @Param('id', ParseIntPipe) id: number) {
    return this.intake.generateAiSummary(id, await this.actorContext(req));
  }

  @Get('sessions/:id')
  async getSession(@Req() req: IntakeRequest, @Param('id', ParseIntPipe) id: number) {
    return this.intake.getSession(id, await this.actorContext(req));
  }

  @Patch('sessions/:id')
  @UseGuards(StaffIntakeWriteGuard)
  async patchSession(
    @Req() req: IntakeRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchIntakeSessionBody,
  ) {
    return this.intake.updateSession(id, body, await this.actorContext(req));
  }

  @Post('sessions/:id/complete')
  @UseGuards(StaffIntakeWriteGuard)
  async completeSession(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: IntakeRequest,
  ) {
    const actorId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    return this.intake.completeSession(id, actorId, await this.actorContext(req));
  }

  @Delete('sessions/:id')
  @UseGuards(StaffIntakeWriteGuard)
  async deleteSession(@Req() req: IntakeRequest, @Param('id', ParseIntPipe) id: number) {
    return this.intake.deleteSession(id, await this.actorContext(req));
  }
}
