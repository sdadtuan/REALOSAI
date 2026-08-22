import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Post,
  Query,
  Req,
  Res,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffLeadsWriteGuard } from '../leads/guards/staff-leads-write.guard';
import { StaffLeadsViewGuard } from '../leads/guards/staff-leads-view.guard';
import { CskhBoardService } from './cskh-board.service';
import { SlaAlertService } from './sla-alert.service';
import type { CskhSlaTier } from './cskh-board-sla.util';
import { CskhBulkAssignBody, CskhBulkRescheduleBody } from './cskh-board.types';

@Controller('api/crm/cskh-board')
@UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
export class CskhBoardController {
  constructor(
    private readonly board: CskhBoardService,
    private readonly slaAlerts: SlaAlertService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private actor(req: Request & { staffUser?: StaffJwtPayload }): string {
    return String(req.staffUser?.email ?? req.headers['x-ptt-actor'] ?? 'staff');
  }

  @Get()
  list(
    @Query('owner_id') ownerId?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('channel') channel?: string,
    @Query('q') q?: string,
    @Query('sla_filter') slaFilter?: string,
    @Query('sla_tier') slaTier?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filter =
      slaFilter === 'breach' || slaFilter === 'warning' || slaFilter === 'open' ? slaFilter : 'all';
    const tier: CskhSlaTier | 'all' | undefined =
      slaTier === 'first_call_15m' || slaTier === 'b2_complete_4h' || slaTier === 'close_24h'
        ? slaTier
        : slaTier === 'all'
          ? 'all'
          : undefined;
    return this.board.getBoard({
      owner_id: ownerId ? Number(ownerId) : undefined,
      status,
      source,
      channel,
      q,
      sla_filter: filter,
      sla_tier: tier,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /** Phase 2 — rep performance, triage, top breaches, daily digest payload. */
  @Get('manager-intelligence')
  managerIntelligence() {
    return this.board.getManagerIntelligence();
  }

  /** Phase 2 — morning SLA digest (Slack/email payload). */
  @Get('sla-daily-digest')
  slaDailyDigest() {
    return this.board.getSlaDailyDigest();
  }

  /** GDKD — unique breach backlog snapshot for end-of-shift gate (target 0). */
  @Get('breach-backlog')
  breachBacklog() {
    return this.board.getBreachBacklogSnapshot();
  }

  /** E0 — home dashboard SLA + review queue widgets. */
  @Get('home-summary')
  homeSummary() {
    return this.board.getHomeSummary();
  }

  /** E3 — shift handoff report (markdown + breach/review snapshot). */
  @Get('shift-handoff')
  shiftHandoff() {
    return this.board.getShiftHandoff();
  }

  /** E2 — predictive SLA rows (warning window). */
  @Get('sla-predictions')
  async slaPredictions(
    @Query('owner_id') ownerId?: string,
    @Req() req?: Request & { staffUser?: StaffJwtPayload },
  ) {
    const staffUser = req?.staffUser;
    let viewAll = false;
    let filterOwner: number | undefined = ownerId ? Number(ownerId) : undefined;

    if (staffUser) {
      const me = await this.staffAuth.me(staffUser);
      viewAll = this.staffAuth.hasCap(me.caps, 'crm_leads', 'assign');
      if (!viewAll) {
        filterOwner = (await this.staffAuth.resolveCrmStaffUserId(staffUser)) ?? undefined;
      }
    }

    return this.board.getSlaPredictions({
      ownerId: filterOwner,
      viewAll,
    });
  }

  /** E2 — SSE stream of high/imminent SLA alerts (poll fallback on client). */
  @Get('sla-alerts/stream')
  @Sse()
  slaAlertsStream(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ): Observable<MessageEvent> {
    if (!req.staffUser) {
      throw new UnauthorizedException({ error: 'staff_required' });
    }
    return this.slaAlerts.streamForStaff(req.staffUser);
  }

  /** Phase 3 — QA sampling + deal value fill rate for chốt leads. */
  @Get('closed-loop-dashboard')
  closedLoopDashboard(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    return this.board.getClosedLoopDashboard(
      days ? Number(days) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  /** Phase 3 — Playbook A/B: AI script vs SOP chốt ≤24h. */
  @Get('playbook-ab-metrics')
  playbookAbMetrics(@Query('days') days?: string) {
    return this.board.getPlaybookAbMetrics(days ? Number(days) : undefined);
  }

  @Get('export')
  async export(
    @Res({ passthrough: false }) res: Response,
    @Query('owner_id') ownerId?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('channel') channel?: string,
    @Query('q') q?: string,
    @Query('sla_filter') slaFilter?: string,
    @Query('sla_tier') slaTier?: string,
    @Query('format') format?: string,
  ) {
    const filter: 'all' | 'breach' | 'warning' | 'open' =
      slaFilter === 'breach' || slaFilter === 'warning' || slaFilter === 'open' ? slaFilter : 'all';
    const tier: CskhSlaTier | 'all' | undefined =
      slaTier === 'first_call_15m' || slaTier === 'b2_complete_4h' || slaTier === 'close_24h'
        ? slaTier
        : slaTier === 'all'
          ? 'all'
          : undefined;
    const query = {
      owner_id: ownerId ? Number(ownerId) : undefined,
      status,
      source,
      channel,
      q,
      sla_filter: filter,
      sla_tier: tier,
    };
    if (format === 'xlsx') {
      const { buffer, filename } = await this.board.exportXlsx(query);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      return;
    }
    const csv = await this.board.exportCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(csv);
  }

  @Post('bulk-assign')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffLeadsWriteGuard)
  bulkAssign(
    @Body() body: CskhBulkAssignBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    return this.board.bulkAssign(body, this.actor(req));
  }

  @Post('bulk-reschedule')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffLeadsWriteGuard)
  async bulkReschedule(
    @Body() body: CskhBulkRescheduleBody,
    @Req() req: Request & { staffUser?: StaffJwtPayload },
  ) {
    const userId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    return this.board.bulkReschedule(body, this.actor(req), userId);
  }
}
