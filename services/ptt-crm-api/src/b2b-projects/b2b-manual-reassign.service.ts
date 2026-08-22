import { BadRequestException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import {
  assertManualSplitChoice,
  isB2bManualReassignLead,
  ManualSplitRequiredError,
  resolveManualSplitCommission,
  type ManualSplitChoice,
} from './b2b-manual-reassign.util';
import { B2bSlaRepository } from './b2b-sla.repository';

@Injectable()
export class B2bManualReassignService {
  constructor(
    private readonly repo: B2bSlaRepository,
    private readonly config: AppConfigService,
  ) {}

  requiresSplitChoice(lead: {
    b2b_project_id?: string | null;
    lead_flow_kind?: string | null;
  }): boolean {
    return this.config.b2bProjectOs && isB2bManualReassignLead(lead);
  }

  async applyManualOwnerChange(input: {
    leadId: number;
    projectId: string;
    fromOwnerId: number | null;
    toOwnerId: number;
    split: ManualSplitChoice;
    reason?: string;
    skipOwnerUpdate?: boolean;
  }): Promise<void> {
    try {
      assertManualSplitChoice(input.split);
    } catch (err) {
      if (err instanceof ManualSplitRequiredError) {
        throw new BadRequestException({ error: err.code });
      }
      throw err;
    }

    const project = await this.repo.getProject(input.projectId);
    const commission = this.repo.resolveCommission(project);
    const existing = await this.repo.getCommissionSplit(input.leadId);
    const resolved = resolveManualSplitCommission({
      choice: input.split,
      projectFirstTouchPct: commission.firstTouchPct,
      projectCloserPct: commission.closerPct,
      existingFirstTouchPct: existing?.first_touch_pct,
      existingCloserPct: existing?.closer_pct,
    });

    await this.repo.applyHop({
      leadId: input.leadId,
      fromOwnerId: input.fromOwnerId,
      toOwnerId: input.toOwnerId,
      hopKind: 'manual',
      projectId: input.projectId,
      assignReason: input.reason ?? 'manual_reassign',
      firstTouchPct: resolved.firstTouchPct,
      closerPct: resolved.closerPct,
      skipOwnerUpdate: input.skipOwnerUpdate,
      updateCommissionSplit: resolved.updateCommissionSplit,
    });
  }
}
