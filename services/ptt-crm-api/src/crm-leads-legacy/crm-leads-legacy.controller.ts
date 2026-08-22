import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
import { StaffLeadsWriteGuard } from '../leads/guards/staff-leads-write.guard';
import { LeadNotInReviewQueueGuard } from '../leads-funnel/guards/lead-not-in-review-queue.guard';
import { StaffLeadsViewGuard } from '../leads/guards/staff-leads-view.guard';
import { LeadsRepository } from '../leads/leads.repository';
import { LeadsWriteService } from '../leads/leads-write.service';
import { LeadStatusGatePatchOptions } from '../leads/lead-status-gate.service';
import { PatchLeadV1Body } from '../leads/leads.types';
import { CrmLeadsLegacyService } from './crm-leads-legacy.service';
import { LeadAttributionService } from '../leads/lead-attribution.service';
import { LeadAttributionResponse } from '../leads/lead-attribution.types';
import { ChotClosedLoopService } from '../leads/chot-closed-loop.service';
import { AiScoreFeedbackService } from '../ai-intelligence/ai-score-feedback.service';
import { LeadMeetingPrepEnqueueService } from '../lead-meeting-prep/lead-meeting-prep-enqueue.service';
import { AssignLeadBody, CreateLeadActivityBody } from './crm-leads-legacy.types';

@Controller('api/crm/leads')
@UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
export class CrmLeadsLegacyController {
  constructor(
    private readonly legacy: CrmLeadsLegacyService,
    private readonly leadsRepo: LeadsRepository,
    private readonly leadsWrite: LeadsWriteService,
    private readonly attribution: LeadAttributionService,
    private readonly staffAuth: StaffAuthService,
    private readonly closedLoop: ChotClosedLoopService,
    private readonly scoreFeedback: AiScoreFeedbackService,
    private readonly lmpEnqueue: LeadMeetingPrepEnqueueService,
  ) {}

  private actor(req: Request & { staffUser?: StaffJwtPayload }): string {
    return String(req.staffUser?.email ?? req.headers['x-ptt-actor'] ?? 'staff');
  }

  private async statusGateOpts(
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    body: PatchLeadV1Body,
  ): Promise<LeadStatusGatePatchOptions> {
    if (!body.allow_status_override) return {};
    if (req.staffAuthVia === 'internal') {
      return { allowStatusOverride: true };
    }
    if (!req.staffUser) return {};
    const me = await this.staffAuth.me(req.staffUser);
    const canAssign = this.staffAuth.hasCap(me.caps, 'crm_leads', 'assign');
    return { allowStatusOverride: canAssign };
  }

  @Get(':id/attribution')
  async attributionForLead(@Param('id', ParseIntPipe) id: number): Promise<LeadAttributionResponse> {
    const data = await this.attribution.getLeadAttribution(id);
    return {
      data,
      meta: { request_id: this.attribution.newRequestId() },
      errors: [],
    };
  }

  @Get(':id/activities')
  listActivities(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Number(limit) : 100;
    return this.legacy.listActivities(id, Number.isFinite(lim) ? lim : 100).then((activities) => ({
      activities,
    }));
  }

  @Post(':id/activities')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffLeadsWriteGuard, LeadNotInReviewQueueGuard)
  async createActivity(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateLeadActivityBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    const userId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    return this.legacy.createActivity(id, body, this.actor(req), userId);
  }

  @Get(':id/audit')
  audit(@Param('id', ParseIntPipe) id: number) {
    return this.legacy.auditLogs(id);
  }

  @Post(':id/assign')
  @UseGuards(StaffLeadsWriteGuard, LeadNotInReviewQueueGuard)
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AssignLeadBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.legacy.assignLead(id, body, this.actor(req));
  }

  @Patch(':id')
  @UseGuards(StaffLeadsWriteGuard, LeadNotInReviewQueueGuard)
  async patchLead(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchLeadV1Body & { audit_note?: string },
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ) {
    const prev = await this.leadsRepo.getLeadById(id);
    if (!prev) {
      throw new NotFoundException({ error: 'Not found' });
    }
    const gateOpts = await this.statusGateOpts(req, body);
    const lead = await this.leadsWrite.patchLead(id, body, this.actor(req), gateOpts);
    await this.legacy.mirrorPatchAudit(id, prev, lead, this.actor(req), body.audit_note ?? '');
    await this.closedLoop.processAfterPatch({
      leadId: id,
      prevStatus: prev.status,
      nextStatus: lead.status,
      auditNote: body.audit_note ?? '',
      actor: this.actor(req),
    });
    await this.scoreFeedback.onLeadTerminalStatus(id, String(lead.status ?? ''));
    await this.maybeEnqueueM4Learn(id, prev.status, lead.status, lead);
    return { lead };
  }

  private async maybeEnqueueM4Learn(
    leadId: number,
    prevStatus: string | null | undefined,
    nextStatus: string | null | undefined,
    lead: { status?: string | null; client_id?: string | null; agency_client_id?: string | null },
  ): Promise<void> {
    const next = String(nextStatus ?? '').trim().toLowerCase();
    const prev = String(prevStatus ?? '').trim().toLowerCase();
    if (next !== 'chot' && next !== 'lost') return;
    if (prev === next) return;
    const clientId =
      (lead as { client_id?: string | null }).client_id ??
      (lead as { agency_client_id?: string | null }).agency_client_id ??
      null;
    void this.lmpEnqueue.enqueueAfterTerminalStatus(
      leadId,
      next as 'chot' | 'lost',
      clientId,
    );
  }
}
