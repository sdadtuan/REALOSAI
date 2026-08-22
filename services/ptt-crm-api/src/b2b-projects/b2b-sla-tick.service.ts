import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { decideFirstAssign } from './b2b-assign.util';
import { B2bCallsService } from './b2b-calls.service';
import { B2bDncService } from './b2b-dnc.repository';
import { isWithinBusinessHours, resolveSlaAction, shouldStartAiCall } from './b2b-sla.util';
import { B2bSlaRepository } from './b2b-sla.repository';

@Injectable()
export class B2bSlaTickService {
  constructor(
    private readonly repo: B2bSlaRepository,
    private readonly config: AppConfigService,
    private readonly calls: B2bCallsService,
    private readonly dnc: B2bDncService,
  ) {}

  async tick(now: Date): Promise<{ processed: number; hopped: number; queued: number; aiStarted: number }> {
    if (!this.config.b2bProjectOs) {
      return { processed: 0, hopped: 0, queued: 0, aiStarted: 0 };
    }

    const leads = await this.repo.listOpenB2bLeads();
    let hopped = 0;
    let queued = 0;
    let aiStarted = 0;

    for (const lead of leads) {
      const project = await this.repo.getProject(lead.projectId);
      const sla = this.repo.resolveSlaConfig(project);
      const hours = this.repo.resolveBusinessHours(project);
      const inHours = isWithinBusinessHours(hours, now);
      const elapsedMin = Math.max(0, (now.getTime() - lead.assignedAt.getTime()) / 60_000);
      const action = resolveSlaAction({
        score: lead.score,
        elapsedMin,
        hopCount: lead.hopCount,
        hasCallActivity: lead.hasCallActivity,
        answered: lead.answered,
        inHours,
        sla,
      });

      if (action === 'none') {
        continue;
      }

      if (action === 'ai_call') {
        const hasStaffDialed = await this.calls.hasHumanDial(lead.leadId);
        const alreadyAiCalled = await this.calls.hasAiCall(lead.leadId);
        const phone = String(lead.phone ?? '').trim();
        const dncBlocked = phone ? await this.dnc.isBlocked(phone) : false;
        if (
          shouldStartAiCall({
            action,
            hasStaffDialed,
            alreadyAiCalled,
            aiCallEnabled: lead.aiCallEnabled,
            dncBlocked,
          })
        ) {
          if (phone) {
            try {
              await this.calls.startAiCall({ leadId: lead.leadId, phone });
              aiStarted += 1;
            } catch {
              // AI gọi fail → log implicit; tiếp tục SLA hop ở tick sau
            }
          }
        }
        continue;
      }

      if (action === 'gdkd_queue') {
        await this.repo.markGdkdQueue(lead.leadId);
        queued += 1;
        continue;
      }

      if (action === 'hop' && lead.ownerId != null) {
        const pool = await this.repo.loadAssignPool(lead.projectId, {
          excludeStaffId: lead.ownerId,
        });
        const pick = decideFirstAssign({
          timedOut: true,
          ml: null,
          pool,
          score: lead.score,
        });
        if (pick.ownerId && pick.ownerId !== lead.ownerId) {
          const commission = this.repo.resolveCommission(project);
          await this.repo.applyHop({
            leadId: lead.leadId,
            fromOwnerId: lead.ownerId,
            toOwnerId: pick.ownerId,
            hopKind: 'sla_reassign',
            projectId: lead.projectId,
            assignStrategy: pick.strategy,
            assignReason: pick.reason,
            assignConfidence: pick.confidence,
            firstTouchPct: commission.firstTouchPct,
            closerPct: commission.closerPct,
          });
          hopped += 1;
        }
      }
    }

    return { processed: leads.length, hopped, queued, aiStarted };
  }
}
