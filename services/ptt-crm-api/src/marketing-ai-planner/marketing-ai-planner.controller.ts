import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffMarketingAiPlannerApproveGuard,
  StaffMarketingAiPlannerExportGuard,
  StaffMarketingAiPlannerGenerateGuard,
  StaffMarketingAiPlannerViewGuard,
} from './guards/staff-marketing-ai-planner.guard';
import { MarketingAiPlannerService } from './marketing-ai-planner.service';
import type { MktAiDraft, MktAiJobType, MktAiMultiAgentBody, MktAiOptimizeBody, MktAiPlaybookApplyBody, MktAiPptxExportBody } from './marketing-ai-planner.types';

const RETRY_TYPE_MAP: Record<string, MktAiJobType> = {
  strategy: 'strategy_generate',
  campaigns: 'campaign_generate',
  content: 'content_generate',
  quality: 'quality_score',
};

function actorEmail(req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }): string {
  if (req.staffAuthVia === 'internal') return 'internal';
  return req.staffUser?.email ?? 'unknown';
}

@Controller('api/crm/service-lifecycle/:lifecycleId/ai-planner')
@UseGuards(StaffOrInternalKeyGuard, StaffMarketingAiPlannerViewGuard)
export class MarketingAiPlannerController {
  constructor(private readonly planner: MarketingAiPlannerService) {}

  @Get('context')
  context(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.planner.getContext(lifecycleId);
  }

  @Post('brief/prefill-l1-consult')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  prefillBriefFromL1Consult(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: { overwrite?: boolean },
    @Req() req: Request,
  ) {
    return this.planner.prefillBriefFromL1Consult(lifecycleId, actorEmail(req), {
      overwrite: Boolean(body?.overwrite),
    });
  }

  @Patch('brief')
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  patchBrief(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.planner.patchBrief(lifecycleId, body, actorEmail(req));
  }

  @Post('brief/upload')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadBrief(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.planner.uploadBrief(lifecycleId, file, actorEmail(req));
  }

  @Patch('draft')
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  patchDraft(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Partial<MktAiDraft>,
    @Req() req: Request,
  ) {
    return this.planner.patchDraft(lifecycleId, body, actorEmail(req));
  }

  @Post('jobs/strategy')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  runStrategy(@Param('lifecycleId', ParseIntPipe) lifecycleId: number, @Req() req: Request) {
    return this.planner.runStrategyJob(lifecycleId, actorEmail(req));
  }

  @Post('jobs/campaigns')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  runCampaigns(@Param('lifecycleId', ParseIntPipe) lifecycleId: number, @Req() req: Request) {
    return this.planner.runCampaignJob(lifecycleId, actorEmail(req));
  }

  @Post('jobs/content')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  runContent(@Param('lifecycleId', ParseIntPipe) lifecycleId: number, @Req() req: Request) {
    return this.planner.runContentJob(lifecycleId, actorEmail(req));
  }

  @Post('jobs/quality')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  runQuality(@Param('lifecycleId', ParseIntPipe) lifecycleId: number, @Req() req: Request) {
    return this.planner.runQualityJob(lifecycleId, actorEmail(req));
  }

  @Post('jobs/:type/retry')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  retryJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('type') type: string,
    @Req() req: Request,
  ) {
    const jobType = RETRY_TYPE_MAP[type];
    if (!jobType) {
      throw new BadRequestException({ error: 'invalid_job_type', job_type: type });
    }
    return this.planner.retryJob(lifecycleId, jobType, actorEmail(req));
  }

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  apply(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.planner.applyToTmmt(lifecycleId, body, actorEmail(req));
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerExportGuard)
  exportPlan(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: { format?: string },
    @Req() req: Request,
  ) {
    return this.planner.exportPlan(lifecycleId, body?.format ?? 'pdf', actorEmail(req));
  }

  @Get('documents')
  listDocuments(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.planner.listDocuments(lifecycleId);
  }

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadDocument(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('tag') tag: string | undefined,
    @Req() req: Request,
  ) {
    return this.planner.uploadDocument(lifecycleId, file, actorEmail(req), tag?.trim() || undefined);
  }

  @Post('jobs/budget-simulate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  budgetSimulate(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: { count?: number },
    @Req() req: Request,
  ) {
    return this.planner.runBudgetSimulateJob(lifecycleId, actorEmail(req), body?.count ?? 3);
  }

  @Post('budget-scenarios/:scenarioId/apply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  applyBudgetScenario(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('scenarioId', ParseIntPipe) scenarioId: number,
    @Req() req: Request,
  ) {
    return this.planner.applyBudgetScenario(lifecycleId, scenarioId, actorEmail(req));
  }

  @Get('approvals')
  listApprovals(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.planner.listApprovals(lifecycleId);
  }

  @Post('approvals')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  submitApproval(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.planner.submitApproval(lifecycleId, body, actorEmail(req));
  }

  @Post('approvals/:approvalId/decide')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerApproveGuard)
  decideApproval(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('approvalId', ParseIntPipe) approvalId: number,
    @Body() body: { decision?: string; note?: string },
    @Req() req: Request,
  ) {
    return this.planner.decideApproval(lifecycleId, approvalId, body, actorEmail(req));
  }

  @Get('comments')
  listComments(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('plan_version_id') planVersionId?: string,
  ) {
    const pv = planVersionId ? Number(planVersionId) : undefined;
    return this.planner.listComments(lifecycleId, Number.isFinite(pv) ? pv : undefined);
  }

  @Post('comments')
  @HttpCode(HttpStatus.CREATED)
  createComment(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.planner.createComment(lifecycleId, body, actorEmail(req));
  }

  @Get('versions')
  listVersions(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.planner.listPlanVersions(lifecycleId);
  }

  @Get('versions/:versionId')
  getVersion(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.planner.getPlanVersion(lifecycleId, versionId);
  }

  @Post('versions/:versionId/restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  restoreVersion(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Req() req: Request,
  ) {
    return this.planner.restorePlanVersion(lifecycleId, versionId, actorEmail(req));
  }

  @Get('dashboard')
  dashboard(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('weeks') weeks?: string,
    @Query('channel') channel?: string,
  ) {
    return this.planner.getDashboard(lifecycleId, {
      weeks: weeks != null ? Number(weeks) : undefined,
      channel: channel?.trim() || undefined,
    });
  }

  @Get('kpi-closed-loop')
  kpiClosedLoop(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('weeks') weeks?: string,
    @Query('channel') channel?: string,
  ) {
    return this.planner.getKpiClosedLoop(lifecycleId, {
      weeks: weeks != null ? Number(weeks) : undefined,
      channel: channel?.trim() || undefined,
    });
  }

  @Post('jobs/optimize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  optimize(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: MktAiOptimizeBody,
    @Req() req: Request,
  ) {
    return this.planner.runOptimizeJob(lifecycleId, body ?? {}, actorEmail(req));
  }

  @Post('jobs/optimize/weekly-memo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  weeklyMemo(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: { notify?: boolean; dry_run?: boolean },
    @Req() req: Request,
  ) {
    return this.planner.runWeeklyMemoJob(lifecycleId, actorEmail(req), body ?? {});
  }

  @Post('jobs/strategy/competitor-snapshot')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  competitorSnapshot(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Req() req: Request,
  ) {
    return this.planner.runCompetitorSnapshotJob(lifecycleId, actorEmail(req));
  }

  @Get('playbooks')
  listPlaybooks(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.planner.listPlaybooks(lifecycleId);
  }

  @Post('playbooks/:slug/apply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  applyPlaybook(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('slug') slug: string,
    @Body() body: MktAiPlaybookApplyBody,
    @Req() req: Request,
  ) {
    return this.planner.applyPlaybook(lifecycleId, slug.trim(), body ?? {}, actorEmail(req));
  }

  @Post('jobs/multi-agent')
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  async multiAgent(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: MktAiMultiAgentBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.planner.runMultiAgentJob(lifecycleId, body ?? {}, actorEmail(req));
    if ('status' in result && result.status === 'pending') {
      res.status(HttpStatus.ACCEPTED);
    }
    return result;
  }

  @Get('multi-agent/status')
  multiAgentStatus(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.planner.getMultiAgentStatus(lifecycleId);
  }

  @Post('jobs/strategy/scenarios')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  strategyScenarios(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: { count?: number },
    @Req() req: Request,
  ) {
    return this.planner.runStrategyScenariosJob(lifecycleId, actorEmail(req), body?.count ?? 3);
  }

  @Get('strategy/scenarios')
  listStrategyScenarios(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.planner.listStrategyScenarios(lifecycleId);
  }

  @Get('strategy/scenarios/compare')
  compareStrategyScenarios(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('a', ParseIntPipe) scenarioA: number,
    @Query('b', ParseIntPipe) scenarioB: number,
  ) {
    return this.planner.compareStrategyScenarios(lifecycleId, scenarioA, scenarioB);
  }

  @Post('strategy/scenarios/:scenarioId/select')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  selectStrategyScenario(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('scenarioId', ParseIntPipe) scenarioId: number,
    @Req() req: Request,
  ) {
    return this.planner.selectStrategyScenario(lifecycleId, scenarioId, actorEmail(req));
  }

  @Get('section-comments')
  listSectionComments(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('section_key') sectionKey?: string,
  ) {
    return this.planner.listSectionComments(lifecycleId, sectionKey?.trim() || undefined);
  }

  @Post('section-comments')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffMarketingAiPlannerGenerateGuard)
  createSectionComment(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: { section_key: string; body: string; mention_email?: string },
    @Req() req: Request,
  ) {
    return this.planner.createSectionComment(lifecycleId, body ?? {}, actorEmail(req));
  }

  @Post('export/pptx')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffMarketingAiPlannerExportGuard)
  exportPptx(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: MktAiPptxExportBody,
    @Req() req: Request,
  ) {
    return this.planner.exportPptx(lifecycleId, body ?? {}, actorEmail(req));
  }
}
