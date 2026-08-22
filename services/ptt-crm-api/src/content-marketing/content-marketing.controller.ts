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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { ContentAuditService } from './content-audit.service';
import { ContentCalendarService } from './content-calendar.service';
import { ContentCommentsService } from './content-comments.service';
import { ContentEmailBridgeService } from './content-email-bridge.service';
import { ContentGenerateService } from './content-generate.service';
import { ContentIntelligenceService } from './content-intelligence.service';
import { ContentMetricsService } from './content-metrics.service';
import { ContentIdeaService } from './content-idea.service';
import { ContentItemService } from './content-item.service';
import { ContentPlanSnapshotService } from './content-plan-snapshot.service';
import { ContentProductionService } from './content-production.service';
import { ContentPillarService } from './content-pillar.service';
import { ContentRepurposeService } from './content-repurpose.service';
import { ContentSeoBridgeSyncService } from './content-seo-bridge-sync.service';
import { ContentMediaGenerateService } from './content-media-generate.service';
import { ContentMediaImageProvider } from './content-media-image.provider';
import { ContentVisualService } from './content-visual.service';
import { ContentSeoBridgeService } from './content-seo-bridge.service';
import { ContentWorkflowService } from './content-workflow.service';
import { ContentMarketingService } from './content-marketing.service';
import {
  StaffContentMarketingApproveGuard,
  StaffContentMarketingAssignGuard,
  StaffContentMarketingGenerateGuard,
  StaffContentMarketingProductionGuard,
  StaffContentMarketingPublishGuard,
  StaffContentMarketingViewGuard,
  StaffContentMarketingWriteGuard,
} from './guards/staff-content-marketing.guard';

function actorEmail(req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }): string {
  if (req.staffAuthVia === 'internal') return 'internal';
  return req.staffUser?.email ?? 'unknown';
}

@Controller('api/crm/service-lifecycle/:lifecycleId/content-marketing')
@UseGuards(StaffOrInternalKeyGuard, StaffContentMarketingViewGuard)
export class ContentMarketingController {
  constructor(
    private readonly contentMarketing: ContentMarketingService,
    private readonly ideas: ContentIdeaService,
    private readonly items: ContentItemService,
    private readonly snapshots: ContentPlanSnapshotService,
    private readonly generate: ContentGenerateService,
    private readonly workflow: ContentWorkflowService,
    private readonly calendar: ContentCalendarService,
    private readonly audit: ContentAuditService,
    private readonly comments: ContentCommentsService,
    private readonly repurpose: ContentRepurposeService,
    private readonly seoBridge: ContentSeoBridgeService,
    private readonly emailBridge: ContentEmailBridgeService,
    private readonly production: ContentProductionService,
    private readonly media: ContentMediaGenerateService,
    private readonly visual: ContentVisualService,
    private readonly metrics: ContentMetricsService,
    private readonly intelligence: ContentIntelligenceService,
    private readonly pillars: ContentPillarService,
    private readonly seoBridgeSync: ContentSeoBridgeSyncService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Get('context')
  context(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.contentMarketing.getContext(lifecycleId);
  }

  @Get('plan-snapshot')
  planSnapshot(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.snapshots.getPlanSnapshot(lifecycleId);
  }

  @Get('plan-snapshot/drift-diff')
  planSnapshotDriftDiff(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.snapshots.getDriftDiff(lifecycleId);
  }

  @Post('plan-snapshot/ingest')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  ingestPlanSnapshot(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.snapshots.ingestPlanSnapshot(lifecycleId, body, actorEmail(req));
  }

  @Post('plan-snapshot/seal')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  sealPlanSnapshot(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.snapshots.sealPlanSnapshot(lifecycleId);
  }

  @Get('ideas')
  listIdeas(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('status') status?: string,
    @Query('pillar_id') pillarId?: string,
  ) {
    return this.ideas.listIdeas(lifecycleId, {
      status: status || undefined,
      pillar_id: pillarId != null && pillarId !== '' ? Number(pillarId) : undefined,
    });
  }

  @Post('ideas')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  createIdea(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.ideas.createIdea(lifecycleId, body, actorEmail(req));
  }

  @Patch('ideas/:ideaId')
  @UseGuards(StaffContentMarketingWriteGuard)
  patchIdea(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('ideaId', ParseIntPipe) ideaId: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.ideas.patchIdea(lifecycleId, ideaId, body);
  }

  @Post('ideas/:ideaId/convert')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  convertIdea(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('ideaId', ParseIntPipe) ideaId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.ideas.convertIdea(lifecycleId, ideaId, body, actorEmail(req));
  }

  @Get('items')
  async listItems(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('status') status?: string,
    @Query('format') format?: string,
    @Query('assignee') assignee?: string,
    @Req() req?: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ) {
    let assigneeId: number | undefined;
    if (assignee === 'me' && req?.staffUser) {
      const sid = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
      if (sid != null) assigneeId = sid;
    } else if (assignee != null && assignee !== '' && assignee !== 'me') {
      assigneeId = Number(assignee);
    }
    return this.items.listItems(lifecycleId, {
      status: status || undefined,
      format: format || undefined,
      assignee: assigneeId,
    });
  }

  @Get('items/:itemId')
  getItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.items.getItem(lifecycleId, itemId);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  createItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.items.createItem(lifecycleId, body, actorEmail(req));
  }

  @Patch('items/:itemId')
  @UseGuards(StaffContentMarketingWriteGuard)
  patchItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.items.patchItem(lifecycleId, itemId, body, actorEmail(req));
  }

  @Patch('items/:itemId/assignees')
  @UseGuards(StaffContentMarketingAssignGuard)
  patchItemAssignees(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.items.patchItemAssignees(lifecycleId, itemId, body);
  }

  @Get('items/:itemId/versions')
  listItemVersions(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.items.listItemVersions(lifecycleId, itemId);
  }

  @Get('items/:itemId/versions/compare')
  compareItemVersions(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query('v1') v1?: string,
    @Query('v2') v2?: string,
  ) {
    return this.items.compareItemVersions(
      lifecycleId,
      itemId,
      Number(v1),
      Number(v2),
    );
  }

  @Get('items/:itemId/comments')
  listItemComments(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.comments.listComments(lifecycleId, itemId);
  }

  @Post('items/:itemId/comments')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  addItemComment(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.comments.addComment(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/jobs/draft')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startDraftJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.generate.startDraftJob(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/jobs/variants')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startVariantsJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.generate.startVariantsJob(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/jobs/regenerate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startRegenerateJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.generate.startRegenerateJob(lifecycleId, itemId, body, actorEmail(req));
  }

  @Get('jobs/:jobId')
  getJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    return this.generate.getJob(lifecycleId, jobId);
  }

  @Post('jobs/:jobId/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  cancelJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    return this.generate.cancelJob(lifecycleId, jobId);
  }

  @Post('items/:itemId/submit-review')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  submitReview(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.workflow.submitReview(lifecycleId, itemId, actorEmail(req));
  }

  @Post('items/:itemId/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  approveItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.workflow.approve(lifecycleId, itemId, actorEmail(req));
  }

  @Post('items/:itemId/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  rejectItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.workflow.reject(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/submit-client')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  submitToClient(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.workflow.submitToClient(lifecycleId, itemId, actorEmail(req));
  }

  @Post('items/:itemId/client-approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  clientApproveItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.workflow.clientApprove(lifecycleId, itemId, actorEmail(req));
  }

  @Post('items/:itemId/client-reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  clientRejectItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.workflow.clientReject(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/publish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingPublishGuard)
  publishItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.items.publishItem(lifecycleId, itemId, body, actorEmail(req));
  }

  @Get('review-queue')
  listReviewQueue(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('sla_breach') slaBreach?: string,
    @Query('channel') channel?: string,
  ) {
    return this.workflow.listReviewQueue(lifecycleId, {
      sla_breach: slaBreach === '1' || slaBreach === 'true',
      channel: channel || undefined,
    });
  }

  @Get('review-queue/summary')
  reviewQueueSummary(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.workflow.reviewQueueSummary(lifecycleId);
  }

  @Get('calendar')
  listCalendar(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calendar.listCalendar(lifecycleId, { from, to });
  }

  @Put('calendar/slots/:itemId')
  @UseGuards(StaffContentMarketingWriteGuard)
  upsertCalendarSlot(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.calendar.upsertSlot(lifecycleId, itemId, body, actorEmail(req));
  }

  @Delete('calendar/slots/:itemId')
  @UseGuards(StaffContentMarketingWriteGuard)
  deleteCalendarSlot(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.calendar.deleteSlot(lifecycleId, itemId);
  }

  @Get('audit')
  listAudit(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('limit') limit?: string,
  ) {
    const n = limit != null && limit !== '' ? Number(limit) : 50;
    return this.audit.listAudit(lifecycleId, n);
  }

  @Post('items/:itemId/repurpose')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  repurposeItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.repurpose.repurpose(lifecycleId, itemId, body, actorEmail(req));
  }

  @Get('items/:itemId/derivations')
  listDerivations(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.repurpose.listDerivations(lifecycleId, itemId);
  }

  @Post('items/:itemId/bridge/seo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  bridgeSeo(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.seoBridge.bridgeSeo(lifecycleId, itemId, actorEmail(req));
  }

  @Get('items/:itemId/bridge/seo/status')
  seoBridgeStatus(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query('sync') sync?: string,
    @Req() req?: Request,
  ) {
    if (sync === '1' || sync === 'true') {
      return this.seoBridgeSync.getSeoBridgeStatusWithSync(
        lifecycleId,
        itemId,
        actorEmail(req ?? ({} as Request)),
      );
    }
    return this.seoBridge.getSeoBridgeStatus(lifecycleId, itemId);
  }

  @Post('items/:itemId/bridge/seo/sync')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  syncSeoPublishedUrl(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.seoBridgeSync.syncPublishedUrlFromSeo(lifecycleId, itemId, actorEmail(req));
  }

  @Post('items/:itemId/bridge/email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  bridgeEmail(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.emailBridge.bridgeEmail(lifecycleId, itemId, body, actorEmail(req));
  }

  @Get('items/:itemId/bridge/email/status')
  emailBridgeStatus(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.emailBridge.getEmailBridgeStatus(lifecycleId, itemId);
  }

  @Get('items/:itemId/production')
  getProduction(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.production.getProduction(lifecycleId, itemId);
  }

  @Patch('items/:itemId/production')
  @UseGuards(StaffContentMarketingProductionGuard)
  patchProduction(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.production.patchProduction(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/production/done')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingProductionGuard)
  markProductionDone(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.production.markProductionDone(lifecycleId, itemId, actorEmail(req));
  }

  @Post('items/:itemId/link/creative')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingProductionGuard)
  linkCreative(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.production.linkCreative(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/export/brief-design')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingProductionGuard)
  exportDesignBrief(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.production.exportDesignBrief(lifecycleId, itemId);
  }

  @Post('items/:itemId/export/brief-design/pdf')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingProductionGuard)
  exportDesignBriefPdf(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.production.exportDesignBriefPdf(lifecycleId, itemId);
  }

  @Post('items/:itemId/export/script')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingProductionGuard)
  exportScript(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.production.exportScript(lifecycleId, itemId);
  }

  @Get('visual-review-queue')
  listVisualReviewQueue(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.visual.listVisualReviewQueue(lifecycleId);
  }

  @Post('items/:itemId/jobs/image-generate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startImageGenerateJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.media.startImageJob(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/jobs/carousel-slides')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startCarouselSlidesJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.media.startCarouselSlidesJob(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/jobs/visual-qa')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startVisualQaJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.media.startVisualQaJob(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/jobs/video-short')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startVideoShortJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.media.startVideoShortJob(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/jobs/video-storyboard')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startStoryboard(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.media.startStoryboard(lifecycleId, itemId, body, actorEmail(req));
  }

  @Patch('items/:itemId/video/storyboard')
  @UseGuards(StaffContentMarketingGenerateGuard)
  patchStoryboard(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.media.patchStoryboard(lifecycleId, itemId, body);
  }

  @Post('items/:itemId/jobs/video-render')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startRender(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.media.startRender(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/jobs/video-transcode')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startTranscode(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.media.startTranscode(lifecycleId, itemId, body.packs, actorEmail(req));
  }

  @Post('items/:itemId/jobs/video-qa')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startVideoQa(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.media.startVideoQa(lifecycleId, itemId, actorEmail(req));
  }

  @Post('items/:itemId/video/lock-studio')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  lockStudio(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.media.lockStudio(lifecycleId, itemId, body.studio);
  }

  @Patch('items/:itemId/media/select')
  @UseGuards(StaffContentMarketingGenerateGuard)
  selectMediaAsset(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.media.selectMediaAsset(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/visual/submit-review')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  submitVisualReview(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.visual.submitVisualReview(lifecycleId, itemId, actorEmail(req));
  }

  @Post('items/:itemId/visual/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  approveVisual(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.visual.approveVisual(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/visual/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingApproveGuard)
  rejectVisual(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.visual.rejectVisual(lifecycleId, itemId, body, actorEmail(req));
  }

  @Post('items/:itemId/production/escalate-human')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingProductionGuard)
  escalateHumanProduction(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.visual.escalateHuman(lifecycleId, itemId, body, actorEmail(req));
  }

  @Get('intelligence')
  getIntelligence(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('range') range?: string,
  ) {
    return this.intelligence.getIntelligence(lifecycleId, range);
  }

  @Get('intelligence/summary')
  getIntelligenceSummary(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('range') range?: string,
  ) {
    return this.intelligence.getIntelligence(lifecycleId, range);
  }

  @Get('intelligence/suggestions')
  getIntelligenceSuggestions(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('range') range?: string,
  ) {
    return this.intelligence.getSuggestions(lifecycleId, range);
  }

  @Get('metrics/summary')
  getMetricsSummary(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('range') range?: string,
  ) {
    return this.intelligence.getMetricsSummary(lifecycleId, range);
  }

  @Get('items/:itemId/metrics')
  listItemMetrics(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.metrics.listItemMetrics(lifecycleId, itemId);
  }

  @Post('items/:itemId/metrics')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  createItemMetric(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.metrics.createMetric(lifecycleId, itemId, body, actorEmail(req));
  }

  @Patch('items/:itemId/metrics/:metricId')
  @UseGuards(StaffContentMarketingWriteGuard)
  patchItemMetric(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('metricId', ParseIntPipe) metricId: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.metrics.patchMetric(lifecycleId, itemId, metricId, body);
  }

  @Post('jobs/topic-suggest')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startTopicSuggestJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.intelligence.startTopicSuggestJob(lifecycleId, body, actorEmail(req));
  }

  @Post('jobs/intelligence/weekly-memo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startWeeklyMemoJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.intelligence.startWeeklyMemoJob(lifecycleId, body, actorEmail(req));
  }

  @Post('jobs/intelligence/digest')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startIntelligenceDigestJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.intelligence.startIntelligenceDigestJob(lifecycleId, body, actorEmail(req));
  }

  @Post('intelligence/suggestions/apply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  applyIntelligenceSuggestions(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.intelligence.applySuggestions(lifecycleId, body, actorEmail(req));
  }

  @Post('intelligence/suggestions/bulk-apply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingWriteGuard)
  bulkApplyIntelligenceSuggestions(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.intelligence.bulkApplySuggestions(lifecycleId, body, actorEmail(req));
  }

  @Get('pillars')
  listPillars(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.pillars.listPillars(lifecycleId);
  }

  @Patch('pillars/:pillarId')
  @UseGuards(StaffContentMarketingWriteGuard)
  patchPillar(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('pillarId', ParseIntPipe) pillarId: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.pillars.patchPillar(lifecycleId, pillarId, body);
  }

  @Post('jobs/ideas-bulk')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffContentMarketingGenerateGuard)
  startIdeasBulkJob(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.ideas.startBulkIdeasJob(lifecycleId, body, actorEmail(req));
  }
}
