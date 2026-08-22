import { Injectable } from '@nestjs/common';
import { computeLeadRouteMlV1 } from '../ai-intelligence/lead-route-ml.engine';
import { LeadRouteContext } from '../ai-intelligence/lead-route.types';
import type { ScoreBand } from '../ai-intelligence/lead-score.types';
import { B2B_ANALYTICS_TIMEOUT_MS } from './b2b-projects.constants';
import type { AssignPoolMember, DecideFirstAssignResult } from './b2b-assign.util';
import {
  decideFirstAssignWithAb,
  assignAbBucketForIngest,
} from './b2b-routing-ab.util';
import { B2bRoutingAbService } from './b2b-routing-ab.service';
import { B2bAlertsService } from './b2b-alerts.service';
import { B2bProjectsRepository } from './b2b-projects.repository';
import { isWithinBusinessHours } from './b2b-sla.util';
import { resolveIsActivePttStaff } from './b2b-staff-active.util';
import { B2bSlaRepository } from './b2b-sla.repository';

export interface B2bFirstAssignInput {
  projectId: string;
  score: number | null;
  channel?: string | null;
  source?: string | null;
  phone?: string | null;
  now?: number;
}

export interface B2bFirstAssignMlRouter {
  routeMl(ctx: LeadRouteContext): Promise<{ staffId: number; confidence: number; reason: string } | null>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scoreBand(score: number | null): ScoreBand | null {
  if (score == null) return null;
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

function poolToCandidates(pool: AssignPoolMember[]) {
  return pool.map((p) => ({
    staff_id: p.staffId,
    staff_name: `NV ${p.staffId}`,
    staff_code: String(p.staffId),
    role: 'sales',
    open_leads: p.openFirstTouch,
  }));
}

@Injectable()
export class B2bFirstAssignMlAdapter implements B2bFirstAssignMlRouter {
  async routeMl(ctx: LeadRouteContext): Promise<{ staffId: number; confidence: number; reason: string } | null> {
    const out = computeLeadRouteMlV1(ctx);
    if (!out) return null;
    return {
      staffId: out.recommendedStaffId,
      confidence: out.confidence,
      reason: out.reason,
    };
  }
}

@Injectable()
export class B2bFirstAssignService {
  constructor(
    private readonly repo: B2bSlaRepository,
    private readonly ml: B2bFirstAssignMlAdapter,
    private readonly alerts: B2bAlertsService,
    private readonly projectsRepo: B2bProjectsRepository,
    private readonly routingAb: B2bRoutingAbService,
  ) {}

  async assign(input: B2bFirstAssignInput): Promise<DecideFirstAssignResult> {
    const pool = await this.repo.loadAssignPool(input.projectId);
    const ctx: LeadRouteContext = {
      leadId: 0,
      clientId: null,
      ownerId: null,
      reProjectId: null,
      b2bProjectId: input.projectId,
      channel: input.channel ?? null,
      source: input.source ?? null,
      status: null,
      productLine: null,
      zone: null,
      scoreBand: scoreBand(input.score),
      leadScore: input.score,
      candidates: poolToCandidates(pool),
    };

    let timedOut = false;
    let ml: { staffId: number; confidence: number; reason: string } | null = null;

    const mlResult = await Promise.race([
      this.ml.routeMl(ctx).then((value) => ({ kind: 'ml' as const, value })),
      sleep(B2B_ANALYTICS_TIMEOUT_MS).then(() => ({ kind: 'timeout' as const })),
    ]);

    if (mlResult.kind === 'timeout') {
      timedOut = true;
    } else {
      ml = mlResult.value;
      if (ml && !pool.some((p) => p.staffId === ml!.staffId && !p.inCall)) {
        ml = null;
      }
    }

    const abBucket = assignAbBucketForIngest(
      input.projectId,
      String(input.phone ?? '').trim() || String(input.channel ?? 'unknown'),
    );

    return decideFirstAssignWithAb({ timedOut, ml, pool, score: input.score, abBucket });
  }

  async recordFirstAssignHop(input: {
    leadId: number;
    projectId: string;
    toOwnerId: number;
    assign: DecideFirstAssignResult;
  }): Promise<void> {
    const project = await this.repo.getProject(input.projectId);
    const commission = this.repo.resolveCommission(project);
    await this.repo.applyHop({
      leadId: input.leadId,
      fromOwnerId: null,
      toOwnerId: input.toOwnerId,
      hopKind: 'first_assign',
      projectId: input.projectId,
      assignStrategy: input.assign.strategy,
      assignReason: input.assign.reason,
      assignConfidence: input.assign.confidence,
      firstTouchPct: commission.firstTouchPct,
      closerPct: commission.closerPct,
    });
    await this.routingAb.recordFirstAssign({
      leadId: input.leadId,
      strategy: input.assign.strategy,
    });
  }

  async notifyLeadArrival(input: {
    leadId: number;
    projectId: string;
    ownerId: number | null;
    score: number | null;
  }): Promise<void> {
    const project = await this.repo.getProject(input.projectId);
    const hours = this.repo.resolveBusinessHours(project);
    const inHours = isWithinBusinessHours(hours, new Date());
    const staffRows = await this.projectsRepo.listProjectStaff(input.projectId);
    const receivers = await Promise.all(
      staffRows.map(async (row) => {
        const active = await this.projectsRepo.findStaffActive(Number(row.staff_id));
        return {
          staffId: Number(row.staff_id),
          assignEnabled: Boolean(row.assign_enabled),
          isDirector: false,
          hasViewAllLeads: false,
          isActivePttStaff: resolveIsActivePttStaff(active),
        };
      }),
    );
    await this.alerts.fanoutArrival({
      lead: {
        flowKind: 'b2b_prospect',
        ownerId: input.ownerId,
        projectId: input.projectId,
        score: input.score,
        leadId: input.leadId,
      },
      inHours,
      receivers,
    });
  }
}
