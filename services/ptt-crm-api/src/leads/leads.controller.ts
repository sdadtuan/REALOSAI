import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  ForbiddenException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Request } from 'express';
import { memoryStorage } from 'multer';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { hasGdkdAssign, hasGdkdViewAllLeads } from '../staff-permissions/staff-gdkd.util';
import { StaffRbacAuditRepository } from '../staff-permissions/staff-rbac-audit.repository';
import { PiiAccessAuditService } from '../admin-audit/admin-config-snapshot.service';
import { StaffClientScopeService } from '../staff-client-scope/staff-client-scope.service';
import { AppConfigService } from '../config/app-config.service';
import { B2bLeadScopeService } from '../b2b-projects/b2b-lead-scope.service';
import { B2bCallsService } from '../b2b-projects/b2b-calls.service';
import { B2bCpaasDownError, B2bDncBlockedError } from '../b2b-projects/b2b-calls.types';
import { B2bStringeeTokenService } from '../b2b-projects/b2b-stringee-token.service';
import { B2bIntelligenceService } from '../b2b-projects/b2b-intelligence.service';
import { B2bConversationsService } from '../b2b-projects/b2b-conversations.service';
import {
  assertLeadPatchFieldsAllowed,
  serializeLeadForCaps,
  serializeLeadsForCaps,
} from '../staff-permissions/field-level.serializer';
import { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { WriteEnabledGuard } from './guards/write-enabled.guard';
import { StaffLeadsWriteGuard } from './guards/staff-leads-write.guard';
import { StaffLeadsViewGuard } from './guards/staff-leads-view.guard';
import { LeadNotInReviewQueueGuard } from '../leads-funnel/guards/lead-not-in-review-queue.guard';
import { LeadExportQuery, LeadsIoService } from './leads-io.service';
import { LeadsService } from './leads.service';
import { LeadsWriteService } from './leads-write.service';
import { LeadStatusGatePatchOptions, LeadStatusGateService } from './lead-status-gate.service';
import { LeadSlaCareService } from './lead-sla-care.service';
import { ChotClosedLoopService } from './chot-closed-loop.service';
import { CopilotContextService } from './copilot-context.service';
import { SlaAutoTaskService } from './sla-auto-task.service';
import { CrmConfigService } from '../crm-config/crm-config.service';
import {
  CreateLeadV1Body,
  LeadV1,
  LeadsListResponseV1,
  ListLeadsQuery,
  PatchLeadV1Body,
  BulkAssignLeadsBody,
  BulkAssignLeadsResult,
} from './leads.types';

@Controller('api/v1/leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly leadsWriteService: LeadsWriteService,
    private readonly leadsIo: LeadsIoService,
    private readonly crmConfig: CrmConfigService,
    private readonly staffAuth: StaffAuthService,
    private readonly statusGate: LeadStatusGateService,
    private readonly slaCare: LeadSlaCareService,
    private readonly closedLoop: ChotClosedLoopService,
    private readonly copilotContext: CopilotContextService,
    private readonly slaAutoTask: SlaAutoTaskService,
    private readonly rbacAudit: StaffRbacAuditRepository,
    private readonly clientScope: StaffClientScopeService,
    private readonly piiAudit: PiiAccessAuditService,
    private readonly appConfig: AppConfigService,
    private readonly b2bLeadScope: B2bLeadScopeService,
    private readonly b2bCalls: B2bCallsService,
    private readonly b2bStringeeToken: B2bStringeeTokenService,
    private readonly b2bIntelligence: B2bIntelligenceService,
    private readonly b2bConversations: B2bConversationsService,
  ) {}

  @Get('lookup-options')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  listLookupOptions(@Query('kind') kind?: string) {
    const normalizedKind = kind === 'source' || kind === 'channel' ? kind : undefined;
    return this.crmConfig.listLeadLookups(normalizedKind, true);
  }

  @Get('import/template.xlsx')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  async downloadImportTemplate(@Res({ passthrough: false }) res: Response) {
    const { buffer, filename } = await this.leadsIo.buildTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('export.xlsx')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  async exportLeads(
    @Res({ passthrough: false }) res: Response,
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Query('client_id') clientId?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('channel') channel?: string,
    @Query('q') q?: string,
    @Query('ids') ids?: string,
    @Query('hide_review_queue') hideReviewQueue?: string,
  ) {
    const truthy = (v?: string) => v === '1' || v === 'true';
    const hideExplicitFalse = hideReviewQueue === '0' || hideReviewQueue === 'false';
    const parsedIds = ids
      ? ids
          .split(',')
          .map((part) => Number(part.trim()))
          .filter((id) => Number.isFinite(id) && id > 0)
      : undefined;

    const scope = await this.clientScope.resolveForRequest(req);
    this.clientScope.assertListClientFilter(scope, clientId);

    let b2bListScope: ListLeadsQuery['b2b_list_scope'];
    let b2bExportActor: LeadExportQuery['b2b_export_actor'];
    if (req.staffAuthVia !== 'internal' && req.staffUser && this.appConfig.b2bProjectOs) {
      const me = await this.staffAuth.me(req.staffUser);
      const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
      if (staffId != null) {
        b2bListScope = this.b2bLeadScope.buildListScope({
          staffId,
          caps: me.caps,
          positionCode: me.position_code,
        });
        b2bExportActor = {
          staffId,
          caps: me.caps,
          positionCode: me.position_code,
        };
      }
    }

    const caps = await this.resolveCaps(req);
    const { buffer, filename } = await this.leadsIo.exportXlsx(
      {
        client_id: clientId,
        status,
        source,
        channel,
        q,
        hide_review_queue: hideExplicitFalse ? false : undefined,
        ids: parsedIds?.length ? parsedIds : undefined,
        allowed_client_ids: scope.restricted ? scope.allowedClientIds : undefined,
        b2b_list_scope: b2bListScope,
        b2b_export_actor: b2bExportActor,
      },
      caps,
      (c, s, a) => this.staffAuth.hasCap(c, s, a),
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, WriteEnabledGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importLeads(@UploadedFile() file: Express.Multer.File) {
    return this.leadsIo.importXlsx(file);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, WriteEnabledGuard)
  async createLead(@Body() body: CreateLeadV1Body): Promise<LeadV1> {
    return this.leadsWriteService.createLead(body);
  }

  @Post('bulk-assign')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, WriteEnabledGuard)
  async bulkAssignLeads(
    @Body() body: BulkAssignLeadsBody,
    @Headers('x-ptt-actor') actor?: string,
  ): Promise<BulkAssignLeadsResult> {
    return this.leadsWriteService.bulkAssignLeads(body, actor);
  }

  @Patch(':id')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, WriteEnabledGuard, LeadNotInReviewQueueGuard)
  async patchLead(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchLeadV1Body,
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-ptt-actor') actor?: string,
  ): Promise<LeadV1> {
    if (req.staffAuthVia !== 'internal' && req.staffUser) {
      const caps = await this.resolveCaps(req);
      assertLeadPatchFieldsAllowed(body as Record<string, unknown>, caps, (c, s, a) =>
        this.staffAuth.hasCap(c, s, a),
      );
    }
    const gateOpts = await this.statusGateOpts(req, body);
    const lead = await this.leadsWriteService.patchLead(id, body, actor, gateOpts);
    if (body.allow_status_override && req.staffUser) {
      void this.rbacAudit.log({
        event_type: 'gdkd_status_override',
        actor_email: req.staffUser.email,
        section_id: 'crm_gdkd',
        action: 'override',
        metadata: {
          lead_id: id,
          reason: String(body.status_override_reason ?? body.audit_note ?? '').trim(),
          new_status: body.status ?? lead.status,
        },
      });
    }
    return lead;
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
    const canAssign = hasGdkdAssign(me.caps);
    return { allowStatusOverride: canAssign };
  }

  @Get()
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  async listLeads(
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Query('client_id') clientId?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('channel') channel?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('review_queue_only') reviewQueueOnly?: string,
    @Query('hide_review_queue') hideReviewQueue?: string,
    @Query('owner_id') ownerId?: string,
    @Query('unassigned_only') unassignedOnly?: string,
    @Query('lead_flow_kind') leadFlowKind?: string,
  ): Promise<LeadsListResponseV1> {
    const truthy = (v?: string) => v === '1' || v === 'true';
    const hideExplicitFalse = hideReviewQueue === '0' || hideReviewQueue === 'false';
    const flowKind =
      leadFlowKind === 'spa_operational' || leadFlowKind === 'b2b_prospect'
        ? leadFlowKind
        : undefined;

    let resolvedOwnerId = ownerId ? Number(ownerId) : undefined;
    let b2bListScope: ListLeadsQuery['b2b_list_scope'];
    if (req.staffAuthVia !== 'internal' && req.staffUser) {
      const me = await this.staffAuth.me(req.staffUser);
      const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
      if (this.appConfig.b2bProjectOs && flowKind === 'b2b_prospect' && staffId != null) {
        b2bListScope = this.b2bLeadScope.buildListScope({
          staffId,
          caps: me.caps,
          positionCode: me.position_code,
        });
        if (!b2bListScope.viewAll && !b2bListScope.isDirector) {
          resolvedOwnerId = undefined;
        }
      } else if (!hasGdkdViewAllLeads(me.caps)) {
        if (staffId != null && resolvedOwnerId == null && !truthy(unassignedOnly)) {
          resolvedOwnerId = staffId;
        }
      }
    }

    const scope = await this.clientScope.resolveForRequest(req);
    this.clientScope.assertListClientFilter(scope, clientId);

    return this.leadsService.listLeads({
      client_id: clientId,
      status,
      source,
      channel,
      q,
      limit: limit !== undefined ? Number(limit) : undefined,
      offset: offset !== undefined ? Number(offset) : undefined,
      review_queue_only: truthy(reviewQueueOnly),
      hide_review_queue: hideExplicitFalse ? false : undefined,
      owner_id: resolvedOwnerId,
      unassigned_only: truthy(unassignedOnly),
      lead_flow_kind: flowKind,
      allowed_client_ids: scope.restricted ? scope.allowedClientIds : undefined,
      b2b_list_scope: b2bListScope,
    }).then(async (result) => {
      if (req.staffAuthVia === 'internal' || !req.staffUser) return result;
      const caps = await this.resolveCaps(req);
      return {
        ...result,
        leads: serializeLeadsForCaps(result.leads, caps, (c, s, a) => this.staffAuth.hasCap(c, s, a)),
      };
    });
  }

  @Get(':id/status-options')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  getLeadStatusOptions(@Param('id', ParseIntPipe) id: number) {
    return this.statusGate.getStatusOptions(id);
  }

  /** Phase 1 — SLA-aware care context (Spa Meta 24h): banner, NBA, drafts. */
  @Get(':id/sla-care-context')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  getLeadSlaCareContext(@Param('id', ParseIntPipe) id: number) {
    return this.slaCare.getCareContext(id);
  }

  /** Phase 3 — Chốt closed-loop context (VND, QA flags, hub link). */
  @Get(':id/closed-loop-context')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  getLeadClosedLoopContext(@Param('id', ParseIntPipe) id: number) {
    return this.closedLoop.getLeadContext(id);
  }

  /** Unified copilot context — flow_kind, SLA, funnel, activities, catalog, drafts. */
  @Get(':id/copilot-context')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  getLeadCopilotContext(@Param('id', ParseIntPipe) id: number) {
    return this.copilotContext.getContext(id);
  }

  /** W4 — explainable score + B2B next-best-action for lead detail. */
  @Get(':id/b2b-intelligence')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  async getB2bIntelligence(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ) {
    const lead = await this.leadsService.getLead(id);
    if (!lead) {
      throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
    }
    if (req.staffAuthVia !== 'internal' && req.staffUser) {
      const me = await this.staffAuth.me(req.staffUser);
      const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
      if (staffId != null) {
        await this.b2bLeadScope.assertLeadVisible({
          staffId,
          caps: me.caps,
          positionCode: me.position_code,
          lead: {
            owner_id: lead.owner_id,
            client_id: lead.client_id,
            channel: lead.channel,
            source: lead.source,
            status: lead.status,
            b2b_project_id: lead.b2b_project_id,
            meta_json: { lead_flow_kind: lead.lead_flow_kind },
          },
        });
      }
    }
    return this.b2bIntelligence.getLeadIntelligence(id);
  }

  /** W5 — Zalo OA conversation thread on lead. */
  @Get(':id/b2b-conversation')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  async getB2bConversation(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ) {
    const lead = await this.leadsService.getLead(id);
    if (!lead) {
      throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
    }
    if (req.staffAuthVia !== 'internal' && req.staffUser) {
      const me = await this.staffAuth.me(req.staffUser);
      const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
      if (staffId != null) {
        await this.b2bLeadScope.assertLeadVisible({
          staffId,
          caps: me.caps,
          positionCode: me.position_code,
          lead: {
            owner_id: lead.owner_id,
            client_id: lead.client_id,
            channel: lead.channel,
            source: lead.source,
            status: lead.status,
            b2b_project_id: lead.b2b_project_id,
            meta_json: { lead_flow_kind: lead.lead_flow_kind },
          },
        });
      }
    }
    return this.b2bConversations.getLeadThread(id);
  }

  @Post(':id/b2b-conversation/messages')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard)
  async postB2bConversationMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { body?: string },
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ) {
    const text = String(body?.body ?? '').trim();
    if (!text) {
      throw new HttpException({ error: 'body_required' }, HttpStatus.BAD_REQUEST);
    }
    const lead = await this.leadsService.getLead(id);
    if (!lead) {
      throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
    }
    if (req.staffAuthVia !== 'internal' && req.staffUser) {
      const me = await this.staffAuth.me(req.staffUser);
      const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
      if (staffId != null) {
        await this.b2bLeadScope.assertLeadVisible({
          staffId,
          caps: me.caps,
          positionCode: me.position_code,
          lead: {
            owner_id: lead.owner_id,
            client_id: lead.client_id,
            channel: lead.channel,
            source: lead.source,
            status: lead.status,
            b2b_project_id: lead.b2b_project_id,
            meta_json: { lead_flow_kind: lead.lead_flow_kind },
          },
        });
      }
    }
    return this.b2bConversations.appendOutboundMessage({ leadId: id, body: text });
  }

  /** Phase 3 — Track SCI/talk-track copy for playbook A/B. */
  @Post(':id/closed-loop/script-copy')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard)
  trackCallScriptCopy(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { source?: string },
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    const actor = String(req.staffUser?.email ?? req.headers['x-ptt-actor'] ?? 'staff');
    const raw = String(body?.source ?? 'sci').trim().toLowerCase();
    const source =
      raw === 'sop' || raw === 'manual' ? 'sop' : raw === 'ai_v1' || raw === 'ai' ? 'ai_v1' : 'sci';
    return this.closedLoop.trackCallScriptCopy(id, actor, source).then(() => ({ ok: true }));
  }

  /** E2 — safe SLA reminder activity (BR-AI-01: internal note only). */
  @Post(':id/sla-auto-task')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard)
  async createSlaAutoTask(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      tier: 'first_call_15m' | 'b2_complete_4h' | 'close_24h';
      suggested_action: 'log_call' | 'complete_b2' | 'set_chot_audit' | 'set_lost_reason' | 'reassign';
      message?: string;
    },
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    const actor = String(req.staffUser?.email ?? req.headers['x-ptt-actor'] ?? 'staff');
    const userId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    return this.slaAutoTask.createReminder(id, body, actor, userId);
  }

  /** B2B softphone — mock CPaaS with tel: fallback when down. */
  @Post(':id/calls')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard)
  async startLeadCall(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ) {
    const lead = await this.leadsService.getLead(id);
    if (!lead) {
      throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
    }
    if (req.staffAuthVia !== 'internal' && req.staffUser) {
      const me = await this.staffAuth.me(req.staffUser);
      const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
      if (staffId != null) {
        await this.b2bLeadScope.assertLeadVisible({
          staffId,
          caps: me.caps,
          positionCode: me.position_code,
          lead: {
            owner_id: lead.owner_id,
            client_id: lead.client_id,
            channel: lead.channel,
            source: lead.source,
            status: lead.status,
            b2b_project_id: lead.b2b_project_id,
            meta_json: { lead_flow_kind: lead.lead_flow_kind },
          },
        });
      }
    }
    const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    if (staffId == null) {
      throw new HttpException({ error: 'staff_required' }, HttpStatus.BAD_REQUEST);
    }
    const phone = String(lead.phone ?? '').trim();
    if (!phone) {
      throw new HttpException({ error: 'missing_phone' }, HttpStatus.BAD_REQUEST);
    }
    try {
      const out = await this.b2bCalls.startHumanCall({ leadId: id, staffId, phone });
      return { ok: true, ...out };
    } catch (err) {
      if (err instanceof B2bDncBlockedError) {
        throw new ForbiddenException({ error: 'dnc_blocked' });
      }
      if (err instanceof B2bCpaasDownError) {
        throw new ServiceUnavailableException({ error: 'cpaas_down', tel: phone });
      }
      throw err;
    }
  }

  /** Stringee WebRTC access token for in-browser softphone. */
  @Post(':id/calls/token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard)
  async leadCallToken(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ) {
    const lead = await this.leadsService.getLead(id);
    if (!lead) {
      throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
    }
    if (req.staffAuthVia !== 'internal' && req.staffUser) {
      const me = await this.staffAuth.me(req.staffUser);
      const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
      if (staffId != null) {
        await this.b2bLeadScope.assertLeadVisible({
          staffId,
          caps: me.caps,
          positionCode: me.position_code,
          lead: {
            owner_id: lead.owner_id,
            client_id: lead.client_id,
            channel: lead.channel,
            source: lead.source,
            status: lead.status,
            b2b_project_id: lead.b2b_project_id,
            meta_json: { lead_flow_kind: lead.lead_flow_kind },
          },
        });
      }
    }
    const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    if (staffId == null) {
      throw new HttpException({ error: 'staff_required' }, HttpStatus.BAD_REQUEST);
    }
    const phone = String(lead.phone ?? '').trim();
    if (!phone) {
      throw new HttpException({ error: 'missing_phone' }, HttpStatus.BAD_REQUEST);
    }
    if (!this.b2bStringeeToken.isConfigured()) {
      throw new ServiceUnavailableException({ error: 'cpaas_down', tel: phone });
    }
    const token = this.b2bStringeeToken.createStaffUserToken(staffId);
    if (!token) {
      throw new ServiceUnavailableException({ error: 'cpaas_down', tel: phone });
    }
    return {
      ...token,
      from_number: this.appConfig.stringeeFromNumber,
      to_number: phone,
      lead_id: id,
    };
  }

  @Get(':id')
  @UseGuards(StaffOrInternalKeyGuard)
  async getLead(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ): Promise<LeadV1> {
    const lead = await this.leadsService.getLead(id);
    if (!lead) {
      throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
    }
    const scope = await this.clientScope.resolveForRequest(req);
    this.clientScope.assertLeadAccessible(scope, lead.client_id);
    if (this.appConfig.b2bProjectOs && req.staffAuthVia !== 'internal' && req.staffUser) {
      const me = await this.staffAuth.me(req.staffUser);
      const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
      if (staffId != null) {
        await this.b2bLeadScope.assertLeadVisible({
          staffId,
          caps: me.caps,
          positionCode: me.position_code,
          lead: {
            owner_id: lead.owner_id,
            client_id: lead.client_id,
            channel: lead.channel,
            source: lead.source,
            status: lead.status,
            b2b_project_id: lead.b2b_project_id,
            meta_json: { lead_flow_kind: lead.lead_flow_kind },
          },
        });
      }
    }
    if (req.staffAuthVia === 'internal' || !req.staffUser) return lead;
    const caps = await this.resolveCaps(req);
    const serialized = serializeLeadForCaps(lead, caps, (c, s, a) => this.staffAuth.hasCap(c, s, a));
    if (this.staffAuth.hasCap(caps, 'crm_leads', 'view_pii') && req.staffUser.email) {
      void this.piiAudit.logLeadPiiView({
        actor_email: req.staffUser.email,
        lead_id: id,
        request_path: req.originalUrl ?? `/api/v1/leads/${id}`,
      });
    }
    return serialized;
  }

  private async resolveCaps(
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ): Promise<StaffSectionCap[]> {
    if (!req.staffUser) return [];
    const me = await this.staffAuth.me(req.staffUser);
    return me.caps;
  }
}
