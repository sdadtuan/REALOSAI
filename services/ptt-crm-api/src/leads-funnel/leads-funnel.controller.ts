import {
  Body,
  Controller,
  Get,
  ForbiddenException,
  HttpCode,
  HttpException,
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
import { InternalKeyGuard } from '../auth/internal-key.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffLeadsViewGuard } from '../leads/guards/staff-leads-view.guard';
import { StaffLeadsWriteGuard } from '../leads/guards/staff-leads-write.guard';
import {
  AdvancePresalesBody,
  CompleteCareStageBody,
  ConsultPrefillBody,
  EnsurePresalesBody,
  HandoffSolutionBody,
  PatchMarketingPlanBody,
  PatchPresalesL2DocsBody,
  PatchPresalesTaskBody,
  PresalesAiAssistBody,
  PresalesConsultSlaReminderBody,
  ReleaseReviewQueueBody,
  UpgradePresalesWorkflowBody,
  BatchUpgradePresalesWorkflowBody,
} from './leads-funnel.types';
import { LeadsFunnelEnabledGuard, PresalesOnLeadGuard } from './guards/leads-funnel-enabled.guard';
import { StaffLeadsGdkdGuard } from './guards/staff-leads-gdkd.guard';
import { LeadNotInReviewQueueGuard } from './guards/lead-not-in-review-queue.guard';
import {
  StaffPresalesSolutionClaimGuard,
  StaffPresalesSolutionQueueGuard,
  StaffPresalesSolutionReleaseGuard,
} from './guards/staff-presales-solution.guard';
import { StaffMarketingAiPlannerGenerateGuard } from '../marketing-ai-planner/guards/staff-marketing-ai-planner.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { LeadsFunnelService } from './leads-funnel.service';
import { AppConfigService } from '../config/app-config.service';
import { B2bLeadScopeService, type B2bListScope } from '../b2b-projects/b2b-lead-scope.service';

@Controller('api/v1/leads')
@UseGuards(LeadsFunnelEnabledGuard)
export class LeadsFunnelController {
  constructor(
    private readonly funnel: LeadsFunnelService,
    private readonly staffAuth: StaffAuthService,
    private readonly appConfig: AppConfigService,
    private readonly b2bLeadScope: B2bLeadScopeService,
  ) {}

  private actor(req: Request & { staffUser?: StaffJwtPayload }): string {
    return String(req.staffUser?.email ?? req.headers['x-ptt-actor'] ?? 'staff');
  }

  private userId(req: Request & { staffUser?: StaffJwtPayload }): Promise<number | null> {
    return this.staffAuth.resolveCrmStaffUserId(req.staffUser);
  }

  private async b2bReviewQueueScope(
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ): Promise<B2bListScope | undefined> {
    if (req.staffAuthVia === 'internal' || !req.staffUser || !this.appConfig.b2bProjectOs) {
      return undefined;
    }
    const me = await this.staffAuth.me(req.staffUser);
    const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    if (staffId == null) return undefined;
    return this.b2bLeadScope.buildListScope({
      staffId,
      caps: me.caps,
      positionCode: me.position_code,
    });
  }

  private badRequest(err: unknown): never {
    if (err instanceof ForbiddenException) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpException({ error: msg, message: msg }, HttpStatus.BAD_REQUEST);
  }

  @Get('review-queue/count')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, StaffLeadsGdkdGuard)
  async reviewQueueCount(
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ) {
    return this.funnel.reviewQueueCount(await this.b2bReviewQueueScope(req));
  }

  @Get('review-queue/metrics')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, StaffLeadsGdkdGuard)
  async reviewQueueMetrics(
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Query('limit') limit?: string,
  ) {
    const scope = await this.b2bReviewQueueScope(req);
    return this.funnel.reviewQueueMetrics(limit ? Number(limit) : undefined, scope);
  }

  @Get('review-queue')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, StaffLeadsGdkdGuard)
  async listReviewQueue(
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Number(limit) : 50;
    const scope = await this.b2bReviewQueueScope(req);
    return this.funnel.listReviewQueue(Number.isFinite(lim) ? lim : 50, scope);
  }

  /** Phase 2 — review queue AI summary + suggested owner (rules, BR-AI-018). */
  @Get('review-queue/ai-summaries')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, StaffLeadsGdkdGuard)
  async listReviewQueueAiSummaries(
    @Req() req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Query('limit') limit?: string,
    @Query('mode') mode?: string,
  ) {
    const lim = limit ? Number(limit) : 50;
    const triageMode = mode === 'llm' ? 'llm' : 'rules';
    const scope = await this.b2bReviewQueueScope(req);
    return this.funnel.listReviewQueueAiSummaries(
      Number.isFinite(lim) ? lim : 50,
      triageMode,
      scope,
    );
  }

  @Post('review-queue/sync')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalKeyGuard)
  syncReviewQueue(
    @Query('dry_run') dryRun?: string,
    @Req() req?: Request & { staffUser?: StaffJwtPayload },
  ) {
    const actor = req ? this.actor(req) : 'system:b2_review';
    return this.funnel.syncReviewQueue(actor, dryRun === '1' || dryRun === 'true');
  }

  @Get(':id/funnel')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  getFunnel(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getFunnel(id);
  }

  @Get(':id/care-pipeline')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
  getCarePipeline(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getCarePipeline(id);
  }

  @Post(':id/care-pipeline/report')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, LeadNotInReviewQueueGuard)
  async submitCareReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CompleteCareStageBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.submitCareReport(
        id,
        body,
        this.actor(req),
        await this.userId(req),
      );
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/care-pipeline/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, LeadNotInReviewQueueGuard)
  completeCareStage(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CompleteCareStageBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return this.funnel.completeCareStage(id, body, this.actor(req));
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/review-queue/release')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsGdkdGuard)
  releaseReviewQueue(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReleaseReviewQueueBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return this.funnel.releaseReviewQueue(id, body, this.actor(req));
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Get(':id/presales')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresales(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getPresales(id);
  }

  @Post(':id/presales')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  ensurePresales(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: EnsurePresalesBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return this.funnel.ensurePresales(id, body, this.actor(req));
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Get(':id/presales/consult-gate')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getConsultGate(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getConsultAdvanceGate(id);
  }

  @Post(':id/presales/advance')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async advancePresales(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdvancePresalesBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      const allowOverride = req.staffUser
        ? await this.funnel.staffHasAssignCap(req.staffUser)
        : false;
      return this.funnel.advancePresales(id, body, allowOverride, req.staffUser);
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/handoff-solution')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async handoffToSolution(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: HandoffSolutionBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.handoffToSolution(
        id,
        body,
        await this.userId(req),
        this.actor(req),
        req.staffUser,
      );
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Get(':id/presales/policy-preview')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  async presalesPolicyPreview(
    @Param('id', ParseIntPipe) id: number,
    @Query('action') action: string,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    const act = String(action ?? 'release').trim().toLowerCase();
    if (act !== 'release' && act !== 'claim') {
      throw new HttpException({ error: 'invalid_action' }, HttpStatus.BAD_REQUEST);
    }
    return this.funnel.previewPresalesPolicy(id, act, req.staffUser);
  }

  @Post(':id/presales/claim-solution')
  @HttpCode(HttpStatus.OK)
  @UseGuards(
    StaffOrInternalKeyGuard,
    StaffLeadsWriteGuard,
    PresalesOnLeadGuard,
    LeadNotInReviewQueueGuard,
    StaffPresalesSolutionClaimGuard,
  )
  async claimSolution(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.claimSolution(
        id,
        await this.userId(req),
        this.actor(req),
        req.staffUser,
      );
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Post(':id/presales/release-to-sales')
  @HttpCode(HttpStatus.OK)
  @UseGuards(
    StaffOrInternalKeyGuard,
    StaffLeadsWriteGuard,
    PresalesOnLeadGuard,
    LeadNotInReviewQueueGuard,
    StaffPresalesSolutionReleaseGuard,
  )
  async releaseToSales(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    try {
      return await this.funnel.releaseToSales(
        id,
        await this.userId(req),
        this.actor(req),
        req.staffUser,
      );
    } catch (err) {
      this.badRequest(err);
    }
  }

  @Patch(':id/presales/tasks/:taskId')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async patchPresalesTask(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() body: PatchPresalesTaskBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.patchPresalesTask(id, taskId, body, await this.userId(req), req.staffUser);
  }

  @Get(':id/presales/marketing-plan')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getMarketingPlan(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getMarketingPlan(id);
  }

  @Patch(':id/presales/marketing-plan')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  patchMarketingPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchMarketingPlanBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.patchMarketingPlan(id, body, req.staffUser);
  }

  @Post(':id/presales/marketing-plan/ai-draft')
  @HttpCode(HttpStatus.OK)
  @UseGuards(
    StaffOrInternalKeyGuard,
    StaffLeadsWriteGuard,
    StaffMarketingAiPlannerGenerateGuard,
    PresalesOnLeadGuard,
    LeadNotInReviewQueueGuard,
  )
  generatePresalesMarketingPlanAiDraft(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.generatePresalesMarketingPlanAiDraft(id, req.staffUser);
  }

  @Get(':id/presales/consult-brief')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresalesConsultBrief(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getPresalesConsultBrief(id);
  }

  @Post(':id/presales/consult-prefill')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  prefillPresalesConsult(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ConsultPrefillBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.prefillPresalesConsult(id, body, req.staffUser);
  }

  @Get(':id/presales/proposal-gate')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresalesProposalGate(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getPresalesProposalGate(id);
  }

  @Get(':id/presales/proposal-handoff')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresalesProposalHandoff(@Param('id', ParseIntPipe) id: number) {
    return this.funnel.getPresalesProposalHandoff(id);
  }

  @Get('presales/solution-queue')
  @UseGuards(StaffOrInternalKeyGuard, StaffPresalesSolutionQueueGuard, PresalesOnLeadGuard)
  listSolutionQueue(@Query('status') status?: string, @Query('limit') limit?: string) {
    const lim = limit ? Number(limit) : 50;
    return this.funnel.listSolutionQueue(status?.trim(), Number.isFinite(lim) ? lim : 50);
  }

  @Get('presales/consult-sla/summary')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresalesConsultSlaSummary(@Query('am_id') amId?: string) {
    const parsed = amId != null && amId !== '' ? Number(amId) : null;
    return this.funnel.getPresalesConsultSlaSummary(
      parsed != null && Number.isFinite(parsed) ? parsed : null,
    );
  }

  @Get('presales/funnel-metrics')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getPresalesFunnelMetrics(
    @Query('period_start') periodStart?: string,
    @Query('period_end') periodEnd?: string,
    @Query('am_id') amId?: string,
  ) {
    const parsedAm = amId != null && amId !== '' ? Number(amId) : null;
    return this.funnel.getPresalesFunnelMetrics({
      periodStart: periodStart?.trim() || null,
      periodEnd: periodEnd?.trim() || null,
      amId: parsedAm != null && Number.isFinite(parsedAm) ? parsedAm : null,
    });
  }

  @Post('presales/batch-upgrade-workflow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalKeyGuard)
  batchUpgradePresalesWorkflow(@Body() body: BatchUpgradePresalesWorkflowBody) {
    return this.funnel.batchUpgradePresalesWorkflow(body);
  }

  @Post(':id/presales/consult-sla/reminder')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  async createPresalesConsultSlaReminder(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PresalesConsultSlaReminderBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.createPresalesConsultSlaReminder(
      id,
      body,
      this.actor(req),
      await this.userId(req),
    );
  }

  @Patch(':id/presales/l2-docs')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  patchPresalesL2Docs(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchPresalesL2DocsBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.patchPresalesL2Docs(id, body, req.staffUser);
  }

  @Post(':id/presales/tasks/:taskId/ai-assist')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  runPresalesTaskAiAssist(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() body: PresalesAiAssistBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.funnel.runPresalesTaskAiAssist(id, taskId, body, req.staffUser);
  }

  @Post(':id/presales/upgrade-workflow-template')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard, LeadNotInReviewQueueGuard)
  upgradePresalesWorkflowTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpgradePresalesWorkflowBody,
  ) {
    return this.funnel.upgradePresalesWorkflowTemplate(id, body);
  }
}
